"""
Shared test utilities — no third-party packages required.
"""
import importlib.util
import json
import os
import unittest.mock
from io import BytesIO
from unittest.mock import MagicMock

from botocore.exceptions import ClientError

# Root of the lambdas directory (relative to this file)
_LAMBDAS_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "lambdas"))


def load_lambda(subdir: str, filename: str = "handler.py"):
    """
    Load a Lambda module by path so every module gets a unique name in
    sys.modules — prevents handler.py files from different subdirectories
    from colliding with each other.

    boto3.client is mocked during module load so that module-level
      s3 = boto3.client("s3")
    lines don't trigger real AWS credential resolution. Each test's
    setUp replaces mod.s3 with its own MagicMock anyway.
    """
    path = os.path.join(_LAMBDAS_ROOT, subdir, filename)
    module_name = f"prudent_{subdir.replace('/', '_')}_{filename}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod = importlib.util.module_from_spec(spec)
    with unittest.mock.patch("boto3.client", return_value=MagicMock()):
        spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# S3 response helpers
# ---------------------------------------------------------------------------

def s3_body(data) -> dict:
    """Fake a successful S3 GetObject response."""
    return {"Body": BytesIO(json.dumps(data).encode())}


def s3_error(code: str = "NoSuchKey") -> ClientError:
    """Return a ClientError with the given error code."""
    return ClientError({"Error": {"Code": code, "Message": "mock error"}}, "Operation")


def head_404() -> ClientError:
    """HeadObject 404 (used in register_user idempotency check)."""
    return ClientError({"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject")


# ---------------------------------------------------------------------------
# Event builders
# ---------------------------------------------------------------------------

def api_event(
    method: str = "POST",
    body=None,
    path_params: dict = None,
    query_params: dict = None,
    user_id: str = "user-123",
) -> dict:
    """Build a minimal API Gateway proxy event."""
    return {
        "httpMethod": method,
        "body": json.dumps(body) if body is not None else None,
        "pathParameters": path_params or {},
        "queryStringParameters": query_params or {},
        "requestContext": {"authorizer": {"claims": {"sub": user_id}}},
    }


def cognito_event(
    user_id: str = "user-123",
    given_name: str = "Jane",
    family_name: str = "Doe",
    email: str = "jane@example.com",
    extra: dict = None,
) -> dict:
    """Build a Cognito PostAuthentication trigger event."""
    attrs = {
        "sub": user_id,
        "given_name": given_name,
        "family_name": family_name,
        "email": email,
    }
    if extra:
        attrs.update(extra)
    return {"request": {"userAttributes": attrs}}
