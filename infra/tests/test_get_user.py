import json
import os
import sys
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import api_event, load_lambda, s3_body, s3_error

mod = load_lambda("auth", "get_user.py")

USER_ID = "user-123"
ACCOUNT_ID = "acct-456"

_USER = {"id": USER_ID, "firstName": "Jane", "lastName": "Doe", "email": "jane@example.com", "accountId": ACCOUNT_ID}
_ACCOUNT = {"id": ACCOUNT_ID, "name": "Jane's Budget", "primaryOwner": USER_ID}


class TestGetUser(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    def _event(self):
        return api_event("GET", user_id=USER_ID)

    # ------------------------------------------------------------------
    # Happy path
    # ------------------------------------------------------------------

    def test_returns_200_with_user_and_account(self):
        self.s3.get_object.side_effect = [
            s3_body(_USER),
            s3_body(_ACCOUNT),
        ]
        resp = mod.handler(self._event(), None)
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertEqual(body["user"]["id"], USER_ID)
        self.assertEqual(body["account"]["id"], ACCOUNT_ID)

    def test_returns_user_with_account_none_when_account_missing(self):
        user_without_account = {**_USER, "accountId": None}
        self.s3.get_object.return_value = s3_body(user_without_account)
        resp = mod.handler(self._event(), None)
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertIsNone(body["account"])

    def test_account_fetch_failure_is_handled_gracefully(self):
        """If the account file is missing, account field should be None rather than crashing."""
        self.s3.get_object.side_effect = [
            s3_body(_USER),
            s3_error("NoSuchKey"),
        ]
        resp = mod.handler(self._event(), None)
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertIsNone(body["account"])

    # ------------------------------------------------------------------
    # Error cases
    # ------------------------------------------------------------------

    def test_returns_404_when_user_not_found(self):
        self.s3.get_object.side_effect = s3_error("NoSuchKey")
        resp = mod.handler(self._event(), None)
        self.assertEqual(resp["statusCode"], 404)
        self.assertIn("error", json.loads(resp["body"]))

    def test_propagates_unexpected_s3_error(self):
        self.s3.get_object.side_effect = s3_error("InternalError")
        with self.assertRaises(Exception):
            mod.handler(self._event(), None)


if __name__ == "__main__":
    unittest.main()
