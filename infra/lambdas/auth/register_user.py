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
Cognito PostAuthentication trigger.

Fires after every successful sign-in (including Google OAuth).
On first sign-in it creates the User record, a personal Account, and
empty reference-data files in S3. Subsequent calls are no-ops because
the user record already exists.
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


def handler(event, context):
    attrs = event["request"]["userAttributes"]
    user_id = attrs["sub"]  # Cognito UUID – stable across logins

    user_key = f"Metadata/users/{user_id}.json"

    # Idempotency guard – do nothing if the user already exists
    try:
        s3.head_object(Bucket=S3_BUCKET, Key=user_key)
        return event  # already registered
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "404":
            raise

    now = _now_iso()
    account_id = str(uuid.uuid4())

    given_name = attrs.get("given_name") or attrs.get("name", "").split(" ")[0]
    family_name = attrs.get("family_name") or (
        " ".join(attrs.get("name", "").split(" ")[1:]) if " " in attrs.get("name", "") else ""
    )
    email = attrs.get("email", "")

    # User record
    user = {
        "id": user_id,
        "firstName": given_name,
        "lastName": family_name,
        "email": email,
        "accountIds": [account_id],
        "createdAt": now,
        "updatedAt": now,
    }
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=user_key,
        Body=json.dumps(user),
        ContentType="application/json",
    )

    # Account record
    account = {
        "id": account_id,
        "name": f"{given_name}'s Budget",
        "primaryOwner": user_id,
        "secondaryOwners": [],
        "createdAt": now,
        "updatedAt": now,
    }
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"Metadata/accounts/{account_id}.json",
        Body=json.dumps(account),
        ContentType="application/json",
    )

    # Empty reference-data arrays
    for resource in ("things", "tags", "categories", "budgets", "invites"):
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=f"Metadata/accounts/{account_id}/{resource}.json",
            Body=json.dumps([]),
            ContentType="application/json",
        )

    # Cognito triggers must return the event unchanged
    return event
