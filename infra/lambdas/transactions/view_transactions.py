"""
GET /transactions

Query parameters:
  year   (string, optional – defaults to current year,  e.g. "2026")
  month  (string, optional – defaults to current month, e.g. "04")
  date   (string, optional – if provided, returns only that day, e.g. "10")

Returns a JSON array of transactions for the requested period.
If only year+month are given, all day files for the month are merged.
"""
import json
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

S3_BUCKET = os.environ["S3_BUCKET"]
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")

s3 = boto3.client("s3")


def _response(status: int, body) -> dict:
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

    params = event.get("queryStringParameters") or {}
    now = datetime.now(timezone.utc)
    year = params.get("year", now.strftime("%Y"))
    month = params.get("month", now.strftime("%m"))
    date = params.get("date")

    # Sanitise – only digits allowed to prevent path traversal
    if not (year.isdigit() and month.isdigit() and (date is None or date.isdigit())):
        return _response(400, {"error": "year, month, and date must be numeric"})

    user_obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
    account_id = json.loads(user_obj["Body"].read())["accountId"]

    transactions = []

    if date:
        key = f"Transactions/{account_id}/{year}/{month}/{date}.json"
        try:
            obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
            transactions = json.loads(obj["Body"].read())
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "NoSuchKey":
                raise
    else:
        # Fetch all day files for the month
        prefix = f"Transactions/{account_id}/{year}/{month}/"
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
            for item in page.get("Contents", []):
                try:
                    obj = s3.get_object(Bucket=S3_BUCKET, Key=item["Key"])
                    transactions.extend(json.loads(obj["Body"].read()))
                except ClientError:
                    pass  # skip any unreadable day file

    # Sort chronologically before returning
    transactions.sort(key=lambda t: t.get("createdAt", ""))

    return _response(200, transactions)
