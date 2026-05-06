# Copyright (C) 2026 V.P.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

"""
POST   /transactions                  → create a Transaction
PUT    /transactions/{transactionId}  → update a Transaction
DELETE /transactions/{transactionId}  → delete a Transaction

Transactions are stored per year: Transactions/{accountId}/{year}.json
Structure: { "MM": { "DD": [ ...transactions ] } }

POST body:
  thingId           (string, required if categoryId absent)
  categoryId        (string, required if thingId absent)
  qty               (number, required, positive)
  price             (number, required, non-negative)
  currency          (string, required – ISO 4217, e.g. "USD")
  transactionDate   (string, optional – YYYY-MM-DD, the actual date of the
                    transaction; defaults to today when omitted, e.g. Quick Add)
  tagIds            (string[], optional)
  receiptId         (string, optional)
  receiptLineItemId (string, optional)

PUT body (all optional – omitted fields unchanged):
  thingId / categoryId / tagIds / qty / price / currency / transactionDate
  receiptId / receiptLineItemId
  transactionDate (string, required – YYYY-MM-DD, used to locate the correct
                  year file and day slot)

DELETE body:
  transactionDate (string, required – YYYY-MM-DD, used to locate the correct
                  year file and day slot)
"""
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

S3_BUCKET = os.environ["S3_BUCKET"]
_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
_origin = _ALLOWED_ORIGINS[0] if _ALLOWED_ORIGINS else "*"


def _pick_origin(event: dict) -> None:
    """Set module-level _origin from the request's Origin header (CORS allow-list match)."""
    global _origin
    if "*" in _ALLOWED_ORIGINS:
        _origin = "*"
        return
    headers = event.get("headers") or {}
    request_origin = headers.get("origin") or headers.get("Origin") or ""
    _origin = request_origin if request_origin in _ALLOWED_ORIGINS else (_ALLOWED_ORIGINS[0] if _ALLOWED_ORIGINS else "*")
s3 = boto3.client("s3")

_UPDATABLE = {
    "thingId", "categoryId", "tagIds", "qty", "price",
    "currency", "receiptId", "receiptLineItemId", "type", "transactionDate",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": _origin,
            "Vary": "Origin",
        },
        "body": json.dumps(body),
    }


def _resolve_account_id(user_id: str, event: dict) -> str:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
    user = json.loads(obj["Body"].read())
    account_ids = user.get("accountIds") or ([user["accountId"]] if user.get("accountId") else [])
    if not account_ids:
        raise ValueError("User has no accounts")
    requested = (event.get("headers") or {}).get("X-Account-Id") or \
                (event.get("headers") or {}).get("x-account-id")
    if requested:
        if requested not in account_ids:
            raise PermissionError("Account not accessible")
        return requested
    return account_ids[0]


def _year_key(account_id: str, year: int) -> str:
    return f"Transactions/{account_id}/{year:04d}.json"


def _parse_created_at(created_at: str) -> datetime:
    if len(created_at) == 10:
        created_at += "T00:00:00Z"
    return datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ")


def _parse_transaction_date(date_str: str) -> datetime:
    """Parse a YYYY-MM-DD transaction date."""
    return datetime.strptime(date_str.strip()[:10], "%Y-%m-%d")


def _load_year(key: str) -> dict:
    """Load the year file. Returns {} without error if the file does not exist."""
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return {}
        raise


def _create(body: dict, account_id: str, user_id: str) -> dict:
    if not body.get("thingId") and not body.get("categoryId"):
        return _response(400, {"error": "At least one of thingId or categoryId is required"})

    missing = [f for f in ("qty", "price", "currency") if body.get(f) is None]
    if missing:
        return _response(400, {"error": f"Missing required fields: {', '.join(missing)}"})

    qty, price = body["qty"], body["price"]
    if not isinstance(qty, (int, float)) or qty <= 0:
        return _response(400, {"error": "qty must be a positive number"})
    if not isinstance(price, (int, float)) or price < 0:
        return _response(400, {"error": "price must be a non-negative number"})

    tag_ids = body.get("tagIds", [])
    if not isinstance(tag_ids, list):
        return _response(400, {"error": "tagIds must be an array"})

    now = datetime.now(timezone.utc)
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    # transactionDate is the actual date of the transaction (YYYY-MM-DD).
    # It drives the S3 file placement. Defaults to today when not supplied
    # (Quick Add path never sends it).
    raw_txn_date = body.get("transactionDate")
    if raw_txn_date:
        try:
            txn_dt = _parse_transaction_date(raw_txn_date)
        except ValueError:
            return _response(400, {"error": "transactionDate must be YYYY-MM-DD"})
        transaction_date = txn_dt.strftime("%Y-%m-%d")
    else:
        txn_dt = now
        transaction_date = now.strftime("%Y-%m-%d")

    mm = f"{txn_dt.month:02d}"
    dd = f"{txn_dt.day:02d}"
    key = _year_key(account_id, txn_dt.year)
    year_data = _load_year(key)

    new_txn = {
        "id": str(uuid.uuid4()),
        "accountId": account_id,
        "createdBy": user_id,
        "type": body.get("type", "expense"),
        "transactionDate": transaction_date,
        "thingId": body.get("thingId"),
        "categoryId": body.get("categoryId"),
        "tagIds": tag_ids,
        "qty": qty,
        "price": price,
        "currency": body["currency"].strip().upper(),
        "receiptId": body.get("receiptId"),
        "receiptLineItemId": body.get("receiptLineItemId"),
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    year_data.setdefault(mm, {}).setdefault(dd, []).append(new_txn)
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(year_data), ContentType="application/json")
    return _response(201, new_txn)


def _update(body: dict, account_id: str, transaction_id: str) -> dict:
    if "qty" in body and (not isinstance(body["qty"], (int, float)) or body["qty"] <= 0):
        return _response(400, {"error": "qty must be a positive number"})
    if "price" in body and (not isinstance(body["price"], (int, float)) or body["price"] < 0):
        return _response(400, {"error": "price must be a non-negative number"})
    if "tagIds" in body and not isinstance(body["tagIds"], list):
        return _response(400, {"error": "tagIds must be an array"})
    if body.get("thingId") == "" and body.get("categoryId") == "":
        return _response(400, {"error": "At least one of thingId or categoryId must be set"})

    txn_date = body.get("transactionDate")
    if not txn_date:
        return _response(400, {"error": "transactionDate is required to locate the transaction"})

    try:
        dt = _parse_transaction_date(txn_date)
    except ValueError:
        return _response(400, {"error": "transactionDate must be YYYY-MM-DD"})

    mm = f"{dt.month:02d}"
    dd = f"{dt.day:02d}"
    key = _year_key(account_id, dt.year)
    year_data = _load_year(key)

    day_txns = year_data.get(mm, {}).get(dd, [])
    if not day_txns:
        return _response(404, {"error": "Transaction not found"})

    target = next((t for t in day_txns if t["id"] == transaction_id), None)
    if target is None:
        return _response(404, {"error": "Transaction not found"})
    if target["accountId"] != account_id:
        return _response(403, {"error": "Access denied"})

    for field in _UPDATABLE:
        if field in body:
            target[field] = body[field].strip().upper() if field == "currency" else body[field]
    target["updatedAt"] = _now_iso()

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(year_data), ContentType="application/json")
    return _response(200, target)


def _delete(body: dict, account_id: str, transaction_id: str) -> dict:
    txn_date = body.get("transactionDate")
    if not txn_date:
        return _response(400, {"error": "transactionDate is required to locate the transaction"})

    try:
        dt = _parse_transaction_date(txn_date)
    except ValueError:
        return _response(400, {"error": "transactionDate must be YYYY-MM-DD"})

    mm = f"{dt.month:02d}"
    dd = f"{dt.day:02d}"
    key = _year_key(account_id, dt.year)
    year_data = _load_year(key)

    month_data = year_data.get(mm, {})
    day_txns = month_data.get(dd, [])
    original_len = len(day_txns)
    filtered = [t for t in day_txns if not (t["id"] == transaction_id and t["accountId"] == account_id)]

    if len(filtered) == original_len:
        return _response(404, {"error": "Transaction not found"})

    if filtered:
        year_data[mm][dd] = filtered
    else:
        month_data.pop(dd, None)
        if not month_data:
            year_data.pop(mm, None)

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(year_data), ContentType="application/json")
    return _response(200, {})


def handler(event, context):
    _pick_origin(event)
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    method = event["httpMethod"]

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Request body must be valid JSON"})

    try:
        account_id = _resolve_account_id(user_id, event)
    except PermissionError as exc:
        return _response(403, {"error": str(exc)})
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "User not found"})
        raise

    if method == "POST":
        return _create(body, account_id, user_id)

    if method in ("PUT", "DELETE"):
        transaction_id = (event.get("pathParameters") or {}).get("transactionId")
        if not transaction_id:
            return _response(400, {"error": "transactionId path parameter is required"})
        if method == "PUT":
            return _update(body, account_id, transaction_id)
        return _delete(body, account_id, transaction_id)

    return _response(405, {"error": "Method not allowed"})
