"""
GET  /account  → Return the active account details (members + pending invites)
POST /accounts → Create a new account owned by the caller
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


def _response(status: int, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGINS,
        },
        "body": json.dumps(body),
    }


def _load_user(user_id: str) -> dict:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
    return json.loads(obj["Body"].read())


def _save_user(user_id: str, user: dict):
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"Metadata/users/{user_id}.json",
        Body=json.dumps(user),
        ContentType="application/json",
    )


def _resolve_account_id(user: dict, event: dict) -> str:
    account_ids = user.get("accountIds") or (
        [user["accountId"]] if user.get("accountId") else []
    )
    if not account_ids:
        raise ValueError("User has no accounts")
    requested = (event.get("headers") or {}).get("X-Account-Id") or \
                (event.get("headers") or {}).get("x-account-id")
    if requested:
        if requested not in account_ids:
            raise PermissionError("Account not accessible")
        return requested
    return account_ids[0]


def _load_account(account_id: str) -> dict:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/accounts/{account_id}.json")
    return json.loads(obj["Body"].read())


def _load_invites(account_id: str) -> list:
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/accounts/{account_id}/invites.json")
        return json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return []
        raise


def _resolve_member(user_id: str) -> dict:
    """Return a safe public profile for a user ID."""
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
        u = json.loads(obj["Body"].read())
        return {
            "userId": user_id,
            "firstName": u.get("firstName", ""),
            "lastName": u.get("lastName", ""),
            "email": u.get("email", ""),
        }
    except ClientError:
        return {"userId": user_id, "firstName": "", "lastName": "", "email": ""}


def _get_account(event: dict) -> dict:
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    user = _load_user(user_id)
    try:
        account_id = _resolve_account_id(user, event)
    except PermissionError:
        return _response(403, {"error": "Account not accessible"})
    except ValueError:
        return _response(404, {"error": "No accounts found"})

    account = _load_account(account_id)
    invites = _load_invites(account_id)

    # Resolve member profiles
    member_ids = list(dict.fromkeys(
        ([account.get("primaryOwner")] if account.get("primaryOwner") else []) +
        account.get("secondaryOwners", [])
    ))
    members = [_resolve_member(mid) for mid in member_ids if mid]

    # Only return pending invites
    pending_invites = [i for i in invites if i.get("status") == "pending"]

    return _response(200, {
        "account": account,
        "members": members,
        "pendingInvites": pending_invites,
    })


def _create_account(event: dict) -> dict:
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    body = json.loads(event.get("body") or "{}")
    name = (body.get("name") or "").strip()
    if not name:
        return _response(400, {"error": "name is required"})

    account_id = str(uuid.uuid4())
    now = _now_iso()

    # Create account record
    account = {
        "id": account_id,
        "name": name,
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

    # Create empty resource files for the new account
    for key, value in [
        (f"Metadata/accounts/{account_id}/things.json", []),
        (f"Metadata/accounts/{account_id}/categories.json", []),
        (f"Metadata/accounts/{account_id}/tags.json", []),
        (f"Metadata/accounts/{account_id}/budgets.json", []),
        (f"Metadata/accounts/{account_id}/invites.json", []),
    ]:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(value),
            ContentType="application/json",
        )

    # Add account to the user's accountIds
    user = _load_user(user_id)
    account_ids = user.get("accountIds") or (
        [user["accountId"]] if user.get("accountId") else []
    )
    account_ids.append(account_id)
    user["accountIds"] = account_ids
    _save_user(user_id, user)

    return _response(201, {"account": account})


def handler(event, context):
    method = event.get("httpMethod", "")
    if method == "GET":
        return _get_account(event)
    if method == "POST":
        return _create_account(event)
    return _response(405, {"error": "Method not allowed"})
