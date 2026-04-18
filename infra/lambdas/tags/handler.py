"""
POST /tags         → create a new Tag
PUT  /tags/{tagId} → update an existing Tag

POST body:
  name  (string, required)

PUT body:
  name  (string, required)

Tag names are stored in lowercase. Duplicates within the same account
are rejected.
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


def _load_tags(account_id: str):
    key = f"Metadata/accounts/{account_id}/tags.json"
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return key, json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return key, []
        raise


def _list(account_id: str) -> dict:
    key, tags = _load_tags(account_id)
    return _response(200, tags)


def _create(body: dict, account_id: str) -> dict:
    name = (body.get("name") or "").strip().lower()
    if not name:
        return _response(400, {"error": "name is required"})

    key, tags = _load_tags(account_id)

    if any(t["name"] == name for t in tags):
        return _response(409, {"error": f"Tag '{name}' already exists"})

    now = _now_iso()
    new_tag = {
        "id": str(uuid.uuid4()),
        "accountId": account_id,
        "name": name,
        "createdAt": now,
        "updatedAt": now,
    }
    tags.append(new_tag)

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(tags), ContentType="application/json")
    return _response(201, new_tag)


def _update(body: dict, account_id: str, tag_id: str) -> dict:
    name = (body.get("name") or "").strip().lower()
    if not name:
        return _response(400, {"error": "name is required"})

    key, tags = _load_tags(account_id)

    target = next((t for t in tags if t["id"] == tag_id), None)
    if target is None:
        return _response(404, {"error": "Tag not found"})

    if any(t["name"] == name and t["id"] != tag_id for t in tags):
        return _response(409, {"error": f"Tag '{name}' already exists"})

    target["name"] = name
    target["updatedAt"] = _now_iso()

    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=json.dumps(tags), ContentType="application/json")
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
        tag_id = (event.get("pathParameters") or {}).get("tagId")
        if not tag_id:
            return _response(400, {"error": "tagId path parameter is required"})
        return _update(body, account_id, tag_id)

    return _response(405, {"error": "Method not allowed"})
