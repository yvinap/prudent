"""
POST /receipts

Creates a Receipt metadata record in S3 and returns a short-lived
presigned PUT URL the client uses to upload the raw receipt image
directly to S3 (bypassing Lambda for the binary payload).

Body:
  contentType  (string, optional – MIME type of the image,
                defaults to "image/jpeg")

Response:
  receipt    – the new Receipt record
  uploadUrl  – presigned PUT URL (expires in 5 minutes)

After uploading, the client calls POST /transactions to record
individual line items once the receipt has been reviewed.
"""
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

S3_BUCKET = os.environ["S3_BUCKET"]
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")
PRESIGNED_URL_EXPIRY_SECONDS = 300

s3 = boto3.client("s3")

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
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


def handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Request body must be valid JSON"})

    content_type = body.get("contentType", "image/jpeg")
    if content_type not in _ALLOWED_CONTENT_TYPES:
        return _response(
            400,
            {"error": f"contentType must be one of: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}"},
        )

    # Look up the user's active account
    try:
        user_obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
        user = json.loads(user_obj["Body"].read())
        account_ids = user.get("accountIds") or ([user["accountId"]] if user.get("accountId") else [])
        if not account_ids:
            return _response(404, {"error": "User has no accounts"})
        requested = (event.get("headers") or {}).get("X-Account-Id") or \
                    (event.get("headers") or {}).get("x-account-id")
        if requested and requested not in account_ids:
            return _response(403, {"error": "Account not accessible"})
        account_id = requested if requested else account_ids[0]
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "User not found"})
        raise

    now = datetime.now(timezone.utc)
    year = now.strftime("%Y")
    month = now.strftime("%m")
    now_iso = _now_iso()
    receipt_id = str(uuid.uuid4())

    # Extension hint from content type
    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
    }
    ext = ext_map[content_type]
    raw_s3_key = f"receipts/raw/{account_id}/{year}/{month}/{receipt_id}.{ext}"

    # Presigned URL – the client PUTs the file directly to S3
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": S3_BUCKET,
            "Key": raw_s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=PRESIGNED_URL_EXPIRY_SECONDS,
    )

    # Receipt metadata record
    receipt = {
        "id": receipt_id,
        "accountId": account_id,
        "transactionIds": [],
        "s3Key": raw_s3_key,
        "uploadedBy": user_id,
        "status": "uploaded",
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    receipt_meta_key = f"Receipts/{account_id}/{year}/{month}/{receipt_id}.json"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=receipt_meta_key,
        Body=json.dumps(receipt),
        ContentType="application/json",
    )

    return _response(200, {"receipt": receipt, "uploadUrl": upload_url})
