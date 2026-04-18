"""
POST /transactions                    → add a new Transaction
PUT  /transactions/{transactionId}    → update an existing Transaction

POST body:
  thingId           (string, required if categoryId absent)
  categoryId        (string, required if thingId absent)
  qty               (number, required, positive)
  price             (number, required, non-negative)
  currency          (string, required – ISO 4217, e.g. "USD")
  tagIds            (string[], optional)
  receiptId         (string, optional)
  receiptLineItemId (string, optional)

PUT body (all optional – omitted fields unchanged):
  thingId / categoryId / tagIds / qty / price / currency
  receiptId / receiptLineItemId
  createdAt (string, required – YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ,
             used to locate the correct day file)
"""
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

S3_BUCKET = os.environ["S3_BUCKET"]
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")
s3 = boto3.client("s3")

_UPDATABLE = {
    "thingId", "categoryId", "tagIds", "qty", "price",
    "currency", "receiptId", "receiptLineItemId", "type",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGINS,
        },
        "body": json.dumps(body),
    }


def _get_account_id(user_id: str) -> str:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
    return json.loads(obj["Body"].read())["accountId"]


def _day_key(account_id: str, created_at: str) -> str:
    if len(created_at) == 10:
        created_at += "T00:00:00Z"
    dt = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ")
    return f"Transactions/{account_id}/{dt.year:04d}/{dt.month:02d}/{dt.day:02d}.json"


def _load_day(key: str):
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return []
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
    day_key = f"Transactions/{account_id}/{now.year:04d}/{now.month:02d}/{now.day:02d}.json"

    transactions = _load_day(day_key)

    new_txn = {
        "id": str(uuid.uuid4()),
        "accountId": account_id,
        "createdBy": user_id,
        "type": body.get("type", "expense"),
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
    transactions.append(new_txn)

    s3.put_object(Bucket=S3_BUCKET, Key=day_key, Body=json.dumps(transactions), ContentType="application/json")
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

    created_at = body.get("createdAt")
    if not created_at:
        return _response(400, {"error": "createdAt is required to locate the transaction"})

    try:
        day_key = _day_key(account_id, created_at)
    except ValueError:
        return _response(400, {"error": "createdAt must be YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ"})

    transactions = _load_day(day_key)
    if not transactions:
        return _response(404, {"error": "Transaction not found"})

    target = next((t for t in transactions if t["id"] == transaction_id), None)
    if target is None:
        return _response(404, {"error": "Transaction not found"})
    if target["accountId"] != account_id:
        return _response(403, {"error": "Access denied"})

    for field in _UPDATABLE:
        if field in body:
            target[field] = body[field].strip().upper() if field == "currency" else body[field]
    target["updatedAt"] = _now_iso()

    s3.put_object(Bucket=S3_BUCKET, Key=day_key, Body=json.dumps(transactions), ContentType="application/json")
    return _response(200, target)


def handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    method = event["httpMethod"]

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Request body must be valid JSON"})

    try:
        account_id = _get_account_id(user_id)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "User not found"})
        raise

    if method == "POST":
        return _create(body, account_id, user_id)

    if method == "PUT":
        transaction_id = (event.get("pathParameters") or {}).get("transactionId")
        if not transaction_id:
            return _response(400, {"error": "transactionId path parameter is required"})
        return _update(body, account_id, transaction_id)

    return _response(405, {"error": "Method not allowed"})
