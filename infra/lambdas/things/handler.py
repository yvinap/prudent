"""
POST /things          → create a new Thing
PUT  /things/{thingId} → update an existing Thing

POST body:
  name              (string, required)
  defaultCategoryId (string, optional)

PUT body (all optional – omitted fields unchanged):
  name              (string)
  defaultCategoryId (string – pass null to clear)
"""
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

S3_BUCKET = os.environ["S3_BUCKET"]
s3 = boto3.client("s3")


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


def _list(account_id: str) -> dict:
    key = f"Metadata/accounts/{account_id}/things.json"
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

    key = f"Metadata/accounts/{account_id}/things.json"
    now = _now_iso()

    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        things = json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            things = []
        else:
            raise

    new_thing = {
        "id": str(uuid.uuid4()),
        "accountId": account_id,
        "name": name,
        "defaultCategoryId": body.get("defaultCategoryId"),
        "createdAt": now,
        "updatedAt": now,
    }
    things.append(new_thing)

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(things), ContentType="application/json")
    return _response(201, new_thing)


def _update(body: dict, account_id: str, thing_id: str) -> dict:
    name = body.get("name", "").strip() if "name" in body else None
    if name is not None and not name:
        return _response(400, {"error": "name cannot be empty"})

    key = f"Metadata/accounts/{account_id}/things.json"

    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        things = json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "Thing not found"})
        raise

    target = next((t for t in things if t["id"] == thing_id), None)
    if target is None:
        return _response(404, {"error": "Thing not found"})

    if name is not None:
        target["name"] = name
    if "defaultCategoryId" in body:
        target["defaultCategoryId"] = body["defaultCategoryId"]
    target["updatedAt"] = _now_iso()

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(things), ContentType="application/json")
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
        thing_id = (event.get("pathParameters") or {}).get("thingId")
        if not thing_id:
            return _response(400, {"error": "thingId path parameter is required"})
        return _update(body, account_id, thing_id)

    return _response(405, {"error": "Method not allowed"})
