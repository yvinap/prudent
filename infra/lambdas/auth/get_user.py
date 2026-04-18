"""
GET /me

Returns the authenticated user's profile and account details.
This is the endpoint the frontend calls immediately after completing
the Google OAuth flow and receiving a Cognito JWT.
"""
import json
import os

import boto3
from botocore.exceptions import ClientError

S3_BUCKET = os.environ["S3_BUCKET"]
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")

s3 = boto3.client("s3")


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
        obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
        user = json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "User profile not found"})
        raise

    # Support both legacy single-account (accountId) and new multi-account (accountIds)
    account_ids = user.get("accountIds") or (
        [user["accountId"]] if user.get("accountId") else []
    )

    accounts = []
    for aid in account_ids:
        try:
            obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/accounts/{aid}.json")
            accounts.append(json.loads(obj["Body"].read()))
        except ClientError:
            pass

    return _response(200, {"user": user, "accounts": accounts})
