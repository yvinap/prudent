"""
S3-triggered Lambda — Receipt Parsing with AWS Textract.

Triggered automatically when a receipt image or PDF lands in S3 at:
    receipts/raw/{accountId}/{year}/{month}/{receiptId}.{ext}

Flow:
  1. Extract accountId, year, month, and receiptId from the S3 key.
  2. Load the receipt metadata record; update status → "parsing".
  3. Call Textract AnalyzeExpense on the uploaded file.
  4. Parse the response:
       – receipt date (falls back to today if Textract cannot detect one)
       – line items (description, qty, unit price, currency)
  5. Match each line-item description against known Things in the account.
  6. Save ReceiptLineItem records to S3.
  7. Create a Transaction for each line item, dated to the receipt date.
  8. Update the receipt record: status → "matched", transactionIds populated.
  9. Log a structured message for every significant step (success or failure).
"""

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import unquote_plus

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ["S3_BUCKET"]
DEFAULT_CURRENCY = os.environ.get("DEFAULT_CURRENCY", "USD")

s3 = boto3.client("s3")
textract = boto3.client("textract")

# ── Date / number helpers ─────────────────────────────────────────────────────

_DATE_FORMATS = (
    "%m/%d/%Y", "%m-%d-%Y",
    "%d/%m/%Y", "%d-%m-%Y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%B %d, %Y", "%b %d, %Y",
    "%B %d %Y", "%b %d %Y",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _today_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _parse_receipt_date(text: str) -> str | None:
    """Try common date formats; return YYYY-MM-DD or None on failure."""
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_number(text: str, default: float = 0.0) -> float:
    """Strip currency symbols / commas then parse as float."""
    cleaned = re.sub(r"[^\d.]", "", text)
    try:
        return float(cleaned)
    except ValueError:
        return default


# ── S3 helpers ────────────────────────────────────────────────────────────────

def _load_json(key: str):
    """Return parsed JSON from S3 or None if the object does not exist."""
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return None
        raise


def _save_json(key: str, data) -> None:
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=json.dumps(data),
        ContentType="application/json",
    )


def _update_receipt(meta_key: str, status: str, extra: dict | None = None) -> dict:
    """Load, patch, and re-save the receipt metadata record."""
    receipt = _load_json(meta_key)
    if receipt is None:
        raise ValueError(f"Receipt metadata not found: {meta_key}")
    receipt["status"] = status
    receipt["updatedAt"] = _now_iso()
    if extra:
        receipt.update(extra)
    _save_json(meta_key, receipt)
    return receipt


# ── Thing / Category matching ─────────────────────────────────────────────────

def _find_thing(things: list, description: str) -> dict | None:
    """Return the first Thing whose name matches the description (exact, then substring)."""
    desc = description.lower().strip()
    for thing in things:
        if thing["name"].lower().strip() == desc:
            return thing
    for thing in things:
        name = thing["name"].lower().strip()
        if name in desc or desc in name:
            return thing
    return None


def _default_category_id(categories: list) -> str | None:
    """Return a sensible fallback category id, or None if no categories exist."""
    preferred = ("groceries", "food", "general", "shopping", "other")
    for name in preferred:
        for cat in categories:
            if cat["name"].lower() == name:
                return cat["id"]
    return categories[0]["id"] if categories else None


# ── Textract response parsing ─────────────────────────────────────────────────

def _parse_expense_document(expense_doc: dict) -> tuple[str | None, str | None, list[dict]]:
    """
    Extract (receipt_date, currency, line_items) from a Textract ExpenseDocument.

    line_items is a list of:
        {rawText, description, qty, unitPrice}
    """
    receipt_date: str | None = None
    currency: str | None = None

    for field in expense_doc.get("SummaryFields", []):
        field_type = field.get("Type", {}).get("Text", "")
        value = field.get("ValueDetection", {}).get("Text", "").strip()
        if not value:
            continue
        if field_type == "INVOICE_RECEIPT_DATE" and receipt_date is None:
            receipt_date = _parse_receipt_date(value)
            if receipt_date:
                logger.info("Receipt date detected by Textract: %s", receipt_date)
            else:
                logger.warning("Could not parse Textract date string: %r", value)
        elif field_type == "CURRENCY" and currency is None:
            currency = value.upper()[:3]

    line_items = []
    for group in expense_doc.get("LineItemGroups", []):
        for item in group.get("LineItems", []):
            fields: dict[str, str] = {}
            for f in item.get("LineItemExpenseFields", []):
                ftype = f.get("Type", {}).get("Text", "")
                fval = f.get("ValueDetection", {}).get("Text", "").strip()
                if ftype and fval:
                    fields[ftype] = fval

            description = fields.get("ITEM") or fields.get("PRODUCT_CODE") or ""
            if not description:
                continue  # skip unidentifiable lines

            qty = _parse_number(fields.get("QUANTITY", "1"), default=1.0)
            if qty <= 0:
                qty = 1.0

            if "UNIT_PRICE" in fields:
                unit_price = _parse_number(fields["UNIT_PRICE"])
            elif "PRICE" in fields:
                total_price = _parse_number(fields["PRICE"])
                unit_price = total_price / qty if qty > 1 else total_price
            else:
                unit_price = 0.0

            raw_text = f"{description} {fields.get('QUANTITY', '')}x {fields.get('PRICE', '')}".strip()

            line_items.append(
                {
                    "rawText": raw_text,
                    "description": description,
                    "qty": qty,
                    "unitPrice": unit_price,
                }
            )

    return receipt_date, currency, line_items


# ── Core processing ───────────────────────────────────────────────────────────

def _process_upload(bucket: str, raw_key: str) -> None:
    """Parse one uploaded receipt and persist the results."""

    # receipts/raw/{accountId}/{year}/{month}/{receiptId}.{ext}
    parts = raw_key.split("/")
    if len(parts) != 6 or parts[0] != "receipts" or parts[1] != "raw":
        logger.error("Unexpected S3 key format, skipping: %s", raw_key)
        return

    account_id = parts[2]
    year = parts[3]
    month = parts[4]
    receipt_id = parts[5].rsplit(".", 1)[0]

    meta_key = f"Receipts/{account_id}/{year}/{month}/{receipt_id}.json"
    line_items_key = f"Receipts/{account_id}/{year}/{month}/{receipt_id}/lineItems.json"

    logger.info(
        "Starting receipt parse | receipt_id=%s account_id=%s",
        receipt_id,
        account_id,
    )

    # ── Step 1: mark receipt as parsing ──────────────────────────────────────
    try:
        receipt = _update_receipt(meta_key, "parsing")
        user_id = receipt["uploadedBy"]
    except Exception as exc:
        logger.error(
            "Failed to load receipt metadata | receipt_id=%s error=%s",
            receipt_id,
            exc,
        )
        return

    # ── Step 2: call Textract AnalyzeExpense ──────────────────────────────────
    try:
        resp = textract.analyze_expense(
            Document={"S3Object": {"Bucket": bucket, "Name": raw_key}}
        )
        logger.info("Textract AnalyzeExpense succeeded | receipt_id=%s", receipt_id)
    except Exception as exc:
        logger.error(
            "Textract failed | receipt_id=%s error=%s",
            receipt_id,
            exc,
        )
        _update_receipt(meta_key, "error")
        return

    expense_docs = resp.get("ExpenseDocuments", [])
    if not expense_docs:
        logger.warning(
            "Textract returned no expense documents | receipt_id=%s",
            receipt_id,
        )
        _update_receipt(meta_key, "error")
        return

    receipt_date, currency, parsed_items = _parse_expense_document(expense_docs[0])
    currency = currency or DEFAULT_CURRENCY

    if not receipt_date:
        receipt_date = _today_date()
        logger.info(
            "No date in receipt, using today | receipt_id=%s date=%s",
            receipt_id,
            receipt_date,
        )

    logger.info(
        "Parsed %d line item(s) | receipt_id=%s date=%s currency=%s",
        len(parsed_items),
        receipt_id,
        receipt_date,
        currency,
    )

    if not parsed_items:
        logger.warning("No line items extracted | receipt_id=%s", receipt_id)
        _update_receipt(meta_key, "matched")
        return

    # ── Step 3: load Things and Categories for name matching ─────────────────
    things = _load_json(f"Metadata/accounts/{account_id}/things.json") or []
    categories = _load_json(f"Metadata/accounts/{account_id}/categories.json") or []
    fallback_cat_id = _default_category_id(categories)

    # ── Step 4: build ReceiptLineItems and Transactions ──────────────────────
    now_iso = _now_iso()
    receipt_date_iso = f"{receipt_date}T00:00:00Z"

    dt = datetime.strptime(receipt_date, "%Y-%m-%d")
    day_key = (
        f"Transactions/{account_id}"
        f"/{dt.year:04d}/{dt.month:02d}/{dt.day:02d}.json"
    )
    day_transactions = _load_json(day_key) or []

    receipt_line_items = []
    transaction_ids = []

    for item in parsed_items:
        line_item_id = str(uuid.uuid4())
        transaction_id = str(uuid.uuid4())

        thing = _find_thing(things, item["description"])
        thing_id = thing["id"] if thing else None
        cat_id = (thing.get("defaultCategoryId") if thing else None) or fallback_cat_id

        receipt_line_items.append(
            {
                "id": line_item_id,
                "receiptId": receipt_id,
                "accountId": account_id,
                "rawText": item["rawText"],
                "resolvedThingId": thing_id,
                "resolvedCategoryId": cat_id,
                "qty": item["qty"],
                "unitPrice": item["unitPrice"],
                "currency": currency,
                "transactionId": transaction_id if cat_id else None,
                "createdAt": now_iso,
                "updatedAt": now_iso,
            }
        )

        if not cat_id:
            logger.warning(
                "No category — skipping transaction | line_item_id=%s desc=%r",
                line_item_id,
                item["description"],
            )
            continue

        day_transactions.append(
            {
                "id": transaction_id,
                "accountId": account_id,
                "createdBy": user_id,
                "thingId": thing_id,
                "categoryId": cat_id,
                "tagIds": [],
                "qty": item["qty"],
                "price": item["unitPrice"],
                "currency": currency,
                "receiptId": receipt_id,
                "receiptLineItemId": line_item_id,
                "createdAt": receipt_date_iso,
                "updatedAt": now_iso,
            }
        )
        transaction_ids.append(transaction_id)

        logger.info(
            "Transaction queued | transaction_id=%s thing_id=%s category_id=%s qty=%s price=%s",
            transaction_id,
            thing_id,
            cat_id,
            item["qty"],
            item["unitPrice"],
        )

    # ── Step 5: persist line items ────────────────────────────────────────────
    _save_json(line_items_key, receipt_line_items)
    logger.info(
        "Saved %d line item(s) | receipt_id=%s key=%s",
        len(receipt_line_items),
        receipt_id,
        line_items_key,
    )

    # ── Step 6: persist transactions ──────────────────────────────────────────
    if transaction_ids:
        _save_json(day_key, day_transactions)
        logger.info(
            "Saved %d transaction(s) | receipt_id=%s day_key=%s",
            len(transaction_ids),
            receipt_id,
            day_key,
        )
    else:
        logger.warning(
            "No transactions created (no category matches) | receipt_id=%s",
            receipt_id,
        )

    # ── Step 7: mark receipt as matched ──────────────────────────────────────
    _update_receipt(
        meta_key,
        "matched",
        {"transactionIds": transaction_ids, "receiptDate": receipt_date},
    )
    logger.info(
        "Receipt parsing complete | receipt_id=%s transactions_created=%d",
        receipt_id,
        len(transaction_ids),
    )


# ── Lambda entry point ────────────────────────────────────────────────────────

def handler(event, context):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        raw_key = unquote_plus(record["s3"]["object"]["key"])
        logger.info("S3 event received | bucket=%s key=%s", bucket, raw_key)
        _process_upload(bucket, raw_key)
