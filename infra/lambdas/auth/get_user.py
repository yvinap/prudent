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


def handler(event, context):
    _pick_origin(event)
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
