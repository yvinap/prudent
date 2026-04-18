"""
POST /categories             → create a new Category
PUT  /categories/{categoryId} → update an existing Category

POST body:
  name   (string, required)
  icon   (string, optional)
  color  (string, optional – hex, e.g. "#f97316")

PUT body (all optional – omitted fields unchanged):
  name   (string)
  icon   (string)
  color  (string)
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


def _list(account_id: str) -> dict:
    key = f"Metadata/accounts/{account_id}/categories.json"
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return _response(200, json.loads(obj["Body"].read()))
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(200, [])
        raise


def _create(body: dict, account_id: str) -> dict:
    name = (body.get("name") or "").strip()
    if not name:
        return _response(400, {"error": "name is required"})

    key = f"Metadata/accounts/{account_id}/categories.json"
    now = _now_iso()

    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        categories = json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            categories = []
        else:
            raise

    new_category = {
        "id": str(uuid.uuid4()),
        "accountId": account_id,
        "name": name,
        "icon": body.get("icon", ""),
        "color": body.get("color", "#6b7280"),
        "createdAt": now,
        "updatedAt": now,
    }
    categories.append(new_category)

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(categories), ContentType="application/json")
    return _response(201, new_category)


def _update(body: dict, account_id: str, category_id: str) -> dict:
    name = body.get("name", "").strip() if "name" in body else None
    if name is not None and not name:
        return _response(400, {"error": "name cannot be empty"})

    key = f"Metadata/accounts/{account_id}/categories.json"

    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        categories = json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "Category not found"})
        raise

    target = next((c for c in categories if c["id"] == category_id), None)
    if target is None:
        return _response(404, {"error": "Category not found"})

    if name is not None:
        target["name"] = name
    for field in ("icon", "color"):
        if field in body:
            target[field] = body[field]
    target["updatedAt"] = _now_iso()

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(categories), ContentType="application/json")
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
        return _list(account_id)

    if method == "POST":
        return _create(body, account_id)

    if method == "PUT":
        category_id = (event.get("pathParameters") or {}).get("categoryId")
        if not category_id:
            return _response(400, {"error": "categoryId path parameter is required"})
        return _update(body, account_id, category_id)

    return _response(405, {"error": "Method not allowed"})
