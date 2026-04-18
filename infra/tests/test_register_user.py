import json
import os
import sys
import unittest
from unittest.mock import MagicMock, call

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import cognito_event, head_404, load_lambda, s3_body, s3_error

mod = load_lambda("auth", "register_user.py")

BUCKET = "test-bucket"
USER_ID = "user-123"


class TestRegisterUser(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    # ------------------------------------------------------------------
    # Idempotency
    # ------------------------------------------------------------------

    def test_returns_event_unchanged_when_user_already_exists(self):
        """head_object succeeds → user exists → no writes."""
        self.s3.head_object.return_value = {}
        event = cognito_event(USER_ID)
        result = mod.handler(event, None)
        self.assertEqual(result, event)
        self.s3.put_object.assert_not_called()

    # ------------------------------------------------------------------
    # First-time registration
    # ------------------------------------------------------------------

    def test_creates_user_account_and_reference_files_on_first_login(self):
        """head_object 404 → 6 put_object calls (user + account + 4 ref files)."""
        self.s3.head_object.side_effect = head_404()
        event = cognito_event(USER_ID, given_name="Jane", family_name="Doe", email="jane@example.com")
        result = mod.handler(event, None)
        self.assertEqual(result, event)
        self.assertEqual(self.s3.put_object.call_count, 6)

    def test_user_record_contains_correct_fields(self):
        self.s3.head_object.side_effect = head_404()
        mod.handler(cognito_event(USER_ID, given_name="Jane", family_name="Doe", email="j@x.com"), None)
        calls = self.s3.put_object.call_args_list
        user_call = next(c for c in calls if f"users/{USER_ID}.json" in c.kwargs["Key"])
        user = json.loads(user_call.kwargs["Body"])
        self.assertEqual(user["id"], USER_ID)
        self.assertEqual(user["firstName"], "Jane")
        self.assertEqual(user["lastName"], "Doe")
        self.assertEqual(user["email"], "j@x.com")
        self.assertIn("accountId", user)
        self.assertIn("createdAt", user)

    def test_account_record_is_created_with_correct_owner(self):
        self.s3.head_object.side_effect = head_404()
        mod.handler(cognito_event(USER_ID, given_name="Jane"), None)
        calls = self.s3.put_object.call_args_list
        account_call = next(c for c in calls if "accounts/" in c.kwargs["Key"] and c.kwargs["Key"].endswith(".json"))
        account = json.loads(account_call.kwargs["Body"])
        self.assertEqual(account["primaryOwner"], USER_ID)
        self.assertEqual(account["secondaryOwners"], [])

    def test_four_empty_reference_files_are_created(self):
        self.s3.head_object.side_effect = head_404()
        mod.handler(cognito_event(USER_ID), None)
        calls = self.s3.put_object.call_args_list
        ref_files = [c for c in calls if any(r in c.kwargs["Key"] for r in ("things", "tags", "categories", "budgets"))]
        self.assertEqual(len(ref_files), 4)
        for c in ref_files:
            self.assertEqual(json.loads(c.kwargs["Body"]), [])

    # ------------------------------------------------------------------
    # Name parsing
    # ------------------------------------------------------------------

    def test_falls_back_to_full_name_when_given_name_missing(self):
        self.s3.head_object.side_effect = head_404()
        event = cognito_event(USER_ID, given_name="", family_name="", extra={"name": "John Smith"})
        mod.handler(event, None)
        calls = self.s3.put_object.call_args_list
        user_call = next(c for c in calls if f"users/{USER_ID}.json" in c.kwargs["Key"])
        user = json.loads(user_call.kwargs["Body"])
        self.assertEqual(user["firstName"], "John")
        self.assertEqual(user["lastName"], "Smith")

    def test_propagates_unexpected_s3_error(self):
        self.s3.head_object.side_effect = s3_error("InternalError")
        with self.assertRaises(Exception):
            mod.handler(cognito_event(USER_ID), None)


if __name__ == "__main__":
    unittest.main()
