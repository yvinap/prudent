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


def _resolve_account_id(user_id: str, event: dict) -> str:
    """Return the account ID to operate on.

    The frontend sends the active account in the X-Account-Id header.
    We validate the user is actually a member of that account by checking
    their accountIds list.  Falls back to the first account in the list
    if the header is absent (e.g. legacy clients).
    """
    obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
    user = json.loads(obj["Body"].read())
    # Support legacy single-account field
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
        account_id = _resolve_account_id(user_id, event)
    except PermissionError as exc:
        return _response(403, {"error": str(exc)})
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
