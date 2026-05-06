"""
GET /transactions

Query parameters (all optional):
  year   (string – defaults to current year, e.g. "2026")
  month  (string – zero-padded; if provided, returns only that month, e.g. "04")
  from   (string – start date YYYY-MM-DD, inclusive; requires 'to')
  to     (string – end date   YYYY-MM-DD, inclusive; requires 'from')

Priority: from/to range > month > year-only (all months).
Both 'from' and 'to' must fall within the same 'year'.

Transactions are stored per year: Transactions/{accountId}/{year}.json
Structure: { "MM": { "DD": [ ...transactions ] } }

Returns a flat, chronologically sorted JSON array.
Returns [] if no data exists for the requested period.
"""
import json
import os
from datetime import date, datetime, timezone

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


def _response(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": _origin,
            "Vary": "Origin",
        },
        "body": json.dumps(body),
    }


def _load_year(account_id: str, year: str) -> dict:
    """Load the year file. Returns {} without error if the file does not exist."""
    key = f"Transactions/{account_id}/{year}.json"
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(obj["Body"].read())
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return {}
        raise


def _flatten(year_data: dict, month_filter: str = None,
             from_date: date = None, to_date: date = None) -> list:
    """Flatten year_data into a list, applying the supplied filter."""
    result = []
    for mm, days in year_data.items():
        if month_filter and mm != month_filter:
            continue
        for dd, txns in days.items():
            if from_date is not None or to_date is not None:
                try:
                    ref_year = (from_date or to_date).year
                    txn_date = date(ref_year, int(mm), int(dd))
                except ValueError:
                    continue
                if from_date and txn_date < from_date:
                    continue
                if to_date and txn_date > to_date:
                    continue
            result.extend(txns)
    return result


def handler(event, context):
    _pick_origin(event)
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]

    params = event.get("queryStringParameters") or {}
    now = datetime.now(timezone.utc)
    year = params.get("year", now.strftime("%Y"))
    month = params.get("month")
    from_str = params.get("from")
    to_str = params.get("to")

    # Guard against path traversal
    if not year.isdigit():
        return _response(400, {"error": "year must be numeric"})
    if month is not None and not month.isdigit():
        return _response(400, {"error": "month must be numeric"})

    # Validate date range when either param is supplied
    from_date = None
    to_date = None
    if from_str or to_str:
        if not (from_str and to_str):
            return _response(400, {"error": "Both 'from' and 'to' are required when using a date range"})
        try:
            from_date = datetime.strptime(from_str, "%Y-%m-%d").date()
            to_date = datetime.strptime(to_str, "%Y-%m-%d").date()
        except ValueError:
            return _response(400, {"error": "'from' and 'to' must be YYYY-MM-DD"})
        if from_date > to_date:
            return _response(400, {"error": "'from' must not be after 'to'"})
        if str(from_date.year) != year or str(to_date.year) != year:
            return _response(400, {"error": "'from' and 'to' must both fall within the requested year"})

    # Resolve account
    try:
        user_obj = s3.get_object(Bucket=S3_BUCKET, Key=f"Metadata/users/{user_id}.json")
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchKey":
            return _response(404, {"error": "User not found"})
        raise
    user = json.loads(user_obj["Body"].read())
    account_ids = user.get("accountIds") or ([user["accountId"]] if user.get("accountId") else [])
    if not account_ids:
        return _response(404, {"error": "User has no accounts"})
    requested = (event.get("headers") or {}).get("X-Account-Id") or \
                (event.get("headers") or {}).get("x-account-id")
    if requested and requested not in account_ids:
        return _response(403, {"error": "Account not accessible"})
    account_id = requested if requested else account_ids[0]

    year_data = _load_year(account_id, year)

    # Normalise month to zero-padded string if supplied
    month_filter = f"{int(month):02d}" if month else None

    transactions = _flatten(year_data, month_filter=month_filter,
                            from_date=from_date, to_date=to_date)
    transactions.sort(key=lambda t: t.get("transactionDate") or t.get("createdAt", ""))

    return _response(200, transactions)
