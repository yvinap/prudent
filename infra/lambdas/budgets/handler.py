"""
POST /budgets            → create a new Budget
PUT  /budgets/{budgetId} → update an existing Budget

POST body:
  name        (string, required)
  type        (string, required – "spending" | "saving")
  period      (string, required – "month" | "year")
  amount      (number, required, positive)
  currency    (string, required – ISO 4217, e.g. "USD")
  categoryId  (string, required if tagId absent)
  tagId       (string, required if categoryId absent)

PUT body (all optional – omitted fields unchanged):
  name / type / period / amount / currency / categoryId / tagId

Constraint: exactly one of categoryId or tagId must be non-null.
"""
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

S3_BUCKET = os.environ["S3_BUCKET"]
s3 = boto3.client("s3")

_VALID_TYPES = {"spending", "saving"}
_VALID_PERIODS = {"month", "year"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def _get_account_id(user_id: str) -> str:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
    return json.loads(obj["Body"].read())["accountId"]


def _load_budgets(account_id: str):
    key = f"Metadata/accounts/{account_id}/budgets.json"
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return key, json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return key, []
        raise


def _validate_scope(category_id, tag_id) -> str | None:
    """Returns an error string if the categoryId/tagId constraint is violated."""
    if bool(category_id) == bool(tag_id):
        return "Exactly one of categoryId or tagId must be provided"
    return None


def _create(body: dict, account_id: str) -> dict:
    name = (body.get("name") or "").strip()
    budget_type = body.get("type")
    period = body.get("period")
    amount = body.get("amount")
    currency = (body.get("currency") or "").strip().upper()
    category_id = body.get("categoryId") or None
    tag_id = body.get("tagId") or None

    if not name:
        return _response(400, {"error": "name is required"})
    if budget_type not in _VALID_TYPES:
        return _response(400, {"error": f"type must be one of: {', '.join(_VALID_TYPES)}"})
    if period not in _VALID_PERIODS:
        return _response(400, {"error": f"period must be one of: {', '.join(_VALID_PERIODS)}"})
    if amount is None or not isinstance(amount, (int, float)) or amount <= 0:
        return _response(400, {"error": "amount must be a positive number"})
    if not currency:
        return _response(400, {"error": "currency is required"})
    if err := _validate_scope(category_id, tag_id):
        return _response(400, {"error": err})

    key, budgets = _load_budgets(account_id)
    now = _now_iso()

    new_budget = {
        "id": str(uuid.uuid4()),
        "accountId": account_id,
        "name": name,
        "type": budget_type,
        "period": period,
        "amount": amount,
        "currency": currency,
        "categoryId": category_id,
        "tagId": tag_id,
        "createdAt": now,
        "updatedAt": now,
    }
    budgets.append(new_budget)

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(budgets), ContentType="application/json")
    return _response(201, new_budget)


def _update(body: dict, account_id: str, budget_id: str) -> dict:
    if "type" in body and body["type"] not in _VALID_TYPES:
        return _response(400, {"error": f"type must be one of: {', '.join(_VALID_TYPES)}"})
    if "period" in body and body["period"] not in _VALID_PERIODS:
        return _response(400, {"error": f"period must be one of: {', '.join(_VALID_PERIODS)}"})
    if "amount" in body and (not isinstance(body["amount"], (int, float)) or body["amount"] <= 0):
        return _response(400, {"error": "amount must be a positive number"})

    key, budgets = _load_budgets(account_id)

    target = next((b for b in budgets if b["id"] == budget_id), None)
    if target is None:
        return _response(404, {"error": "Budget not found"})

    for field in ("name", "type", "period", "amount", "categoryId", "tagId"):
        if field in body:
            target[field] = body[field]
    if "currency" in body:
        target["currency"] = body["currency"].strip().upper()

    if err := _validate_scope(target.get("categoryId"), target.get("tagId")):
        return _response(400, {"error": err})

    target["updatedAt"] = _now_iso()

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(budgets), ContentType="application/json")
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

    if method == "GET":
        key, budgets = _load_budgets(account_id)
        return _response(200, budgets)

    if method == "POST":
        return _create(body, account_id)

    if method == "PUT":
        budget_id = (event.get("pathParameters") or {}).get("budgetId")
        if not budget_id:
            return _response(400, {"error": "budgetId path parameter is required"})
        return _update(body, account_id, budget_id)

    return _response(405, {"error": "Method not allowed"})
