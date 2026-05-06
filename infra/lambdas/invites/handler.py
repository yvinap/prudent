"""
POST   /invites              → Create an invite link for the active account
DELETE /invites/{inviteId}   → Revoke a pending invite
POST   /invites/accept       → Accept an invite (caller gets added to the account)
"""
import json
import os
import uuid
from datetime import datetime, timezone, timedelta

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
APP_URL = os.environ.get("APP_URL", "https://prudigo.com")
s3 = boto3.client("s3")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _response(status: int, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": _origin,
            "Vary": "Origin",
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


def _load_account(account_id: str) -> dict:
    obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/accounts/{account_id}.json")
    return json.loads(obj["Body"].read())


def _save_account(account_id: str, account: dict):
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"Metadata/accounts/{account_id}.json",
        Body=json.dumps(account),
        ContentType="application/json",
    )


def _load_invites(account_id: str) -> list:
    try:
        obj = s3.get_object(
            Bucket=S3_BUCKET, Key=f"Metadata/accounts/{account_id}/invites.json"
        )
        return json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return []
        raise


def _save_invites(account_id: str, invites: list):
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"Metadata/accounts/{account_id}/invites.json",
        Body=json.dumps(invites),
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


def _create_invite(event: dict) -> dict:
    """Create an invite token for the active account."""
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    try:
        user = _load_user(user_id)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "User profile not found"})
        raise
    try:
        account_id = _resolve_account_id(user, event)
    except PermissionError:
        return _response(403, {"error": "Account not accessible"})
    except ValueError:
        return _response(404, {"error": "No accounts found"})

    body = json.loads(event.get("body") or "{}")
    label = (body.get("label") or "").strip()  # optional human-friendly label

    invite_id = str(uuid.uuid4())
    token = str(uuid.uuid4())
    now = _now_iso()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    invite = {
        "inviteId": invite_id,
        "accountId": account_id,
        "createdByUserId": user_id,
        "token": token,
        "label": label,
        "status": "pending",
        "createdAt": now,
        "expiresAt": expires_at,
    }

    invites = _load_invites(account_id)
    invites.append(invite)
    _save_invites(account_id, invites)

    # Write a token→accountId index so accept can find the invite in O(1)
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"Metadata/inviteIndex/{token}.json",
        Body=json.dumps({"accountId": account_id, "inviteId": invite_id}),
        ContentType="application/json",
    )

    invite_url = f"{APP_URL}/?invite={token}"
    return _response(201, {"invite": invite, "inviteUrl": invite_url})


def _revoke_invite(invite_id: str, event: dict) -> dict:
    """Mark a pending invite as revoked."""
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    try:
        user = _load_user(user_id)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "User profile not found"})
        raise
    try:
        account_id = _resolve_account_id(user, event)
    except PermissionError:
        return _response(403, {"error": "Account not accessible"})
    except ValueError:
        return _response(404, {"error": "No accounts found"})

    invites = _load_invites(account_id)
    updated = False
    for inv in invites:
        if inv["inviteId"] == invite_id and inv["status"] == "pending":
            inv["status"] = "revoked"
            updated = True
            break

    if not updated:
        return _response(404, {"error": "Invite not found or already resolved"})

    _save_invites(account_id, invites)
    return _response(200, {"ok": True})


def _accept_invite(event: dict) -> dict:
    """Accept an invite — caller gets added as a secondary owner of the account."""
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    body = json.loads(event.get("body") or "{}")
    token = (body.get("token") or "").strip()
    if not token:
        return _response(400, {"error": "token is required"})

    # Scan all accounts to find the invite — inefficient but acceptable at this scale.
    # In practice accounts are few per user, and we could index token→accountId
    # in a separate S3 key if needed.
    #
    # Alternative: store a root-level index: Metadata/inviteIndex/{token}.json → accountId
    # Use that approach here for O(1) lookup.
    index_key = f"Metadata/inviteIndex/{token}.json"
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=index_key)
        index = json.loads(obj["Body"].read())
        account_id = index["accountId"]
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "Invite not found or expired"})
        raise

    invites = _load_invites(account_id)
    now = datetime.now(timezone.utc)
    invite = None
    for inv in invites:
        if inv["token"] == token and inv["status"] == "pending":
            expires = datetime.fromisoformat(inv["expiresAt"].replace("Z", "+00:00"))
            if now > expires:
                return _response(410, {"error": "Invite has expired"})
            invite = inv
            break

    if not invite:
        return _response(404, {"error": "Invite not found or already used"})

    # Mark invite accepted
    invite["status"] = "accepted"
    invite["acceptedByUserId"] = user_id
    invite["acceptedAt"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    _save_invites(account_id, invites)

    # Add user to account's secondaryOwners
    account = _load_account(account_id)
    secondary = account.get("secondaryOwners", [])
    if user_id not in secondary and user_id != account.get("primaryOwner"):
        secondary.append(user_id)
        account["secondaryOwners"] = secondary
        _save_account(account_id, account)

    # Add accountId to the user's accountIds
    user = _load_user(user_id)
    account_ids = user.get("accountIds") or (
        [user["accountId"]] if user.get("accountId") else []
    )
    if account_id not in account_ids:
        account_ids.append(account_id)
        user["accountIds"] = account_ids
        _save_user(user_id, user)

    return _response(200, {"accountId": account_id, "accountName": account.get("name", "")})


def handler(event, context):
    _pick_origin(event)
    method = event.get("httpMethod", "")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    invite_id = path_params.get("inviteId")

    if method == "POST" and path.endswith("/accept"):
        return _accept_invite(event)
    if method == "POST":
        return _create_invite(event)
    if method == "DELETE" and invite_id:
        return _revoke_invite(invite_id, event)
    return _response(405, {"error": "Method not allowed"})
