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

S3_BUCKET = os.environ.get("S3_BUCKET", "prudent-REDACTED-us-east-1")
DEFAULT_CURRENCY = os.environ.get("DEFAULT_CURRENCY", "USD")
_BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-2-lite-v1:0")

_profile = os.environ.get("AWS_PROFILE_NAME")
if _profile:
    _session = boto3.Session(profile_name=_profile)
    s3 = _session.client("s3")
    textract = _session.client("textract")
    bedrock = _session.client("bedrock-runtime")
else:
    s3 = boto3.client("s3")
    textract = boto3.client("textract")
    bedrock = boto3.client("bedrock-runtime")

# ── Date / number helpers ─────────────────────────────────────────────────────

_DATE_FORMATS = (
    "%m/%d/%Y", "%m-%d-%Y",
    "%m/%d/%y", "%m-%d-%y",
    "%d/%m/%Y", "%d-%m-%Y",
    "%d/%m/%y", "%d-%m-%y",
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


def _match_category_bedrock(description: str, categories: list) -> str | None:
    """Use Amazon Nova 2 to pick the best category id for a line-item description."""
    if not categories:
        return None
    category_list = ", ".join(f'"{c["name"]}"' for c in categories)
    prompt = (
        f"You are a receipt-parsing assistant. "
        f"Given the item description below, choose the single most appropriate "
        f"category from the list provided.\n\n"
        f"Item: {description}\n"
        f"Categories: {category_list}\n\n"
        f"Rules:\n"
        f"- Reply with ONLY the exact category name from the list above.\n"
        f"- Do not include punctuation, quotes, explanation, or any other text.\n"
        f"- If no category fits, reply with a single blank line.\n"
        f"- Your entire response must be one of: {category_list} or empty."
    )
    try:
        resp = bedrock.converse(
            modelId=_BEDROCK_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
        )
        matched_name = resp["output"]["message"]["content"][0]["text"].strip().strip('"')
        for cat in categories:
            if cat["name"].lower() == matched_name.lower():
                logger.info(
                    "Bedrock matched category | desc=%r category=%r",
                    description,
                    matched_name,
                )
                return cat["id"]
        logger.warning(
            "Bedrock returned unknown category %r for %r", matched_name, description
        )
    except Exception as exc:
        logger.warning("Bedrock category match failed | desc=%r error=%s", description, exc)
    return None


def _find_or_create_thing(
    things: list,
    account_id: str,
    description: str,
    categories: list,
    fallback_cat_id: str | None,
) -> tuple[dict, bool]:
    """Return (thing, created) — reuses an existing Thing or appends a new one to the list."""
    existing = _find_thing(things, description)
    if existing is not None:
        return existing, False

    cat_id = _match_category_bedrock(description, categories) or fallback_cat_id
    now = _now_iso()
    new_thing = {
        "id": str(uuid.uuid4()),
        "accountId": account_id,
        "name": description.strip(),
        "defaultCategoryId": cat_id,
        "createdAt": now,
        "updatedAt": now,
    }
    things.append(new_thing)
    return new_thing, True


def _default_category_id(categories: list) -> str | None:
    """Return a sensible fallback category id, or None if no categories exist."""
    preferred = ("groceries", "food", "general", "shopping", "other")
    for name in preferred:
        for cat in categories:
            if cat["name"].lower() == name:
                return cat["id"]
    return categories[0]["id"] if categories else None


# ── Textract response parsing ─────────────────────────────────────────────────

def _find_or_create_tag(tags: list, account_id: str, name: str) -> tuple[dict, bool]:
    """Return (tag, created) — reuses an existing tag or appends a new one to the list."""
    norm = name.lower().strip()
    for tag in tags:
        if tag["name"] == norm:
            return tag, False
    now = _now_iso()
    new_tag = {
        "id": str(uuid.uuid4()),
        "accountId": account_id,
        "name": norm,
        "createdAt": now,
        "updatedAt": now,
    }
    tags.append(new_tag)
    return new_tag, True


def _best_summary_fields(summary_fields: list) -> dict[str, str]:
    """
    Collapse SummaryFields into a {field_type: value} dict, keeping the entry
    with the highest ValueDetection Confidence when duplicates exist.
    """
    best: dict[str, tuple[str, float]] = {}  # field_type -> (value, confidence)
    for field in summary_fields:
        field_type = field.get("Type", {}).get("Text", "")
        detection = field.get("ValueDetection", {})
        value = detection.get("Text", "").strip()
        if not field_type or not value:
            continue
        confidence = detection.get("Confidence", 0.0)
        if field_type not in best or confidence > best[field_type][1]:
            best[field_type] = (value, confidence)
    return {k: v for k, (v, _) in best.items()}


def _best_line_item_fields(line_item_expense_fields: list) -> dict[str, str]:
    """
    Collapse LineItemExpenseFields into a {field_type: value} dict, keeping the
    entry with the highest ValueDetection Confidence when duplicates exist.
    """
    best: dict[str, tuple[str, float]] = {}
    for f in line_item_expense_fields:
        ftype = f.get("Type", {}).get("Text", "")
        detection = f.get("ValueDetection", {})
        fval = detection.get("Text", "").strip()
        if not ftype or not fval:
            continue
        confidence = detection.get("Confidence", 0.0)
        if ftype not in best or confidence > best[ftype][1]:
            best[ftype] = (fval, confidence)
    return {k: v for k, (v, _) in best.items()}


def _parse_expense_document(expense_doc: dict) -> tuple[str | None, str | None, str | None, list[dict]]:
    """
    Extract (receipt_date, currency, vendor_name, line_items) from a Textract ExpenseDocument.

    line_items is a list of:
        {rawText, description, qty, unitPrice}
    """
    summary = _best_summary_fields(expense_doc.get("SummaryFields", []))

    receipt_date: str | None = None
    if raw_date := summary.get("INVOICE_RECEIPT_DATE"):
        receipt_date = _parse_receipt_date(raw_date)
        if receipt_date:
            logger.info("Receipt date detected by Textract: %s", receipt_date)
        else:
            logger.warning("Could not parse Textract date string: %r", raw_date)

    currency: str | None = None
    if raw_currency := summary.get("CURRENCY"):
        currency = raw_currency.upper()[:3]

    vendor_name: str | None = summary.get("VENDOR_NAME")
    if vendor_name:
        logger.info("Vendor name detected by Textract: %s", vendor_name)

    line_items = []
    for group in expense_doc.get("LineItemGroups", []):
        for item in group.get("LineItems", []):
            fields = _best_line_item_fields(item.get("LineItemExpenseFields", []))

            description = fields.get("ITEM") or fields.get("PRODUCT_CODE") or ""
            if not description:
                continue  # skip unidentifiable lines
            ##TODO: Costco have discount line items like this: '/647465' - need to handle it. Otherwise the total does not match
            if description.startswith("/") or not re.search(r"[a-zA-Z]", description):
                logger.debug("Skipping non-descriptive line item: %r", description)
                continue

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

    # Append tax as a synthetic line item if present in summary fields
    for tax_field in ("TAX", "TOTAL_TAX"):
        if raw_tax := summary.get(tax_field):
            tax_amount = _parse_number(raw_tax)
            if tax_amount > 0:
                line_items.append(
                    {
                        "rawText": f"Tax {raw_tax}",
                        "description": "Tax",
                        "qty": 1.0,
                        "unitPrice": tax_amount,
                    }
                )
                logger.info("Tax line item added | amount=%s", tax_amount)
                break  # only add once even if both fields are present

    return receipt_date, currency, vendor_name, line_items


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

    receipt_date, currency, vendor_name, parsed_items = _parse_expense_document(expense_docs[0])
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

    # ── Step 3: load Things, Categories, and Tags for name matching ────────────
    things_key = f"Metadata/accounts/{account_id}/things.json"
    things = _load_json(things_key) or []
    things_dirty = False
    categories = _load_json(f"Metadata/accounts/{account_id}/categories.json") or []
    fallback_cat_id = _default_category_id(categories)

    tags_key = f"Metadata/accounts/{account_id}/tags.json"
    tags = _load_json(tags_key) or []
    tags_dirty = False

    vendor_tag_id: str | None = None
    if vendor_name:
        vendor_tag, created = _find_or_create_tag(tags, account_id, vendor_name)
        vendor_tag_id = vendor_tag["id"]
        if created:
            tags_dirty = True
            logger.info("Created vendor tag | tag_id=%s name=%r", vendor_tag_id, vendor_name)

    # ── Step 4: build ReceiptLineItems and Transactions ──────────────────────
    now_iso = _now_iso()

    dt = datetime.strptime(receipt_date, "%Y-%m-%d")
    year_key = f"Transactions/{account_id}/{dt.year:04d}.json"
    mm = f"{dt.month:02d}"
    dd = f"{dt.day:02d}"
    year_data = _load_json(year_key) or {}
    day_transactions = year_data.setdefault(mm, {}).setdefault(dd, [])

    receipt_line_items = []
    transaction_ids = []

    for item in parsed_items:
        line_item_id = str(uuid.uuid4())
        transaction_id = str(uuid.uuid4())

        thing, thing_created = _find_or_create_thing(things, account_id, item["description"], categories, fallback_cat_id)
        if thing_created:
            things_dirty = True
            logger.info("Created new thing | thing_id=%s name=%r", thing["id"], item["description"])
        thing_id = thing["id"]
        cat_id = thing.get("defaultCategoryId") or fallback_cat_id

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
                "type": "expense",
                "transactionDate": receipt_date,
                "thingId": thing_id,
                "categoryId": cat_id,
                "tagIds": [vendor_tag_id] if vendor_tag_id else [],
                "qty": item["qty"],
                "price": item["unitPrice"],
                "currency": currency,
                "receiptId": receipt_id,
                "receiptLineItemId": line_item_id,
                "createdAt": now_iso,
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

    # ── Step 5: persist things (if new things were created) ──────────────────────
    if things_dirty:
        _save_json(things_key, things)
        logger.info("Saved updated things | account_id=%s", account_id)

    # ── Step 5b: persist tags (if a new vendor tag was created) ────────────────
    if tags_dirty:
        _save_json(tags_key, tags)
        logger.info("Saved updated tags | account_id=%s", account_id)

    # ── Step 6: persist line items ────────────────────────────────────────────
    _save_json(line_items_key, receipt_line_items)
    logger.info(
        "Saved %d line item(s) | receipt_id=%s key=%s",
        len(receipt_line_items),
        receipt_id,
        line_items_key,
    )

    # ── Step 7: persist transactions ──────────────────────────────────────────
    if transaction_ids:
        _save_json(year_key, year_data)
        logger.info(
            "Saved %d transaction(s) | receipt_id=%s year_key=%s month=%s day=%s",
            len(transaction_ids),
            receipt_id,
            year_key,
            mm,
            dd,
        )
    else:
        logger.warning(
            "No transactions created (no category matches) | receipt_id=%s",
            receipt_id,
        )

    # ── Step 8: mark receipt as matched ──────────────────────────────────────
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


# ── Local debug entry point ───────────────────────────────────────────────────

# if __name__ == "__main__":
#     logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

#     event = {
#         "Records": [
#             {
#                 "s3": {
#                     "bucket": {"name": S3_BUCKET},
#                     "object": {
#                         "key": "receipts/raw/8df9638b-b13c-43a4-bd5e-c5fc20f8163e/2026/04/f868c09a-1505-4417-a148-cc9cba7a837f.png"
#                     },
#                 }
#             }
#         ]
#     }

#     handler(event, None)
