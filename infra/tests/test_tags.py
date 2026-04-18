import json
import os
import sys
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import api_event, load_lambda, s3_body, s3_error

mod = load_lambda("tags")

USER_ID = "user-123"
ACCOUNT_ID = "acct-456"
TAG_ID = "tag-789"

_EXISTING_TAG = {
    "id": TAG_ID,
    "accountId": ACCOUNT_ID,
    "name": "reimbursable",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
}


class TestTagsHandler(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    def _user(self):
        return s3_body({"accountId": ACCOUNT_ID})

    # ------------------------------------------------------------------
    # POST – create
    # ------------------------------------------------------------------

    def test_create_returns_201_with_lowercase_name(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(api_event("POST", {"name": "Work"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        self.assertEqual(json.loads(resp["body"])["name"], "work")

    def test_create_missing_name_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_duplicate_name_returns_409(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TAG])]
        resp = mod.handler(api_event("POST", {"name": "reimbursable"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 409)

    def test_create_duplicate_case_insensitive_returns_409(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TAG])]
        resp = mod.handler(api_event("POST", {"name": "Reimbursable"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 409)

    def test_create_appends_to_existing_tags(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TAG])]
        mod.handler(api_event("POST", {"name": "travel"}, user_id=USER_ID), None)
        saved = json.loads(self.s3.put_object.call_args.kwargs["Body"])
        self.assertEqual(len(saved), 2)

    # ------------------------------------------------------------------
    # PUT – update
    # ------------------------------------------------------------------

    def test_update_returns_200_with_new_name(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TAG])]
        resp = mod.handler(
            api_event("PUT", {"name": "business"}, path_params={"tagId": TAG_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"])["name"], "business")

    def test_update_not_found_returns_404(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(
            api_event("PUT", {"name": "x"}, path_params={"tagId": "nonexistent"}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 404)

    def test_update_to_same_name_is_allowed(self):
        """Renaming a tag to its own current name should succeed (not a duplicate)."""
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TAG])]
        resp = mod.handler(
            api_event("PUT", {"name": "reimbursable"}, path_params={"tagId": TAG_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 200)

    def test_update_to_existing_other_tag_name_returns_409(self):
        other_tag = {**_EXISTING_TAG, "id": "tag-other", "name": "travel"}
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TAG, other_tag])]
        resp = mod.handler(
            api_event("PUT", {"name": "travel"}, path_params={"tagId": TAG_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 409)

    def test_update_missing_name_returns_400(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TAG])]
        resp = mod.handler(
            api_event("PUT", {"name": ""}, path_params={"tagId": TAG_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 400)

    # ------------------------------------------------------------------
    # General
    # ------------------------------------------------------------------

    def test_unsupported_method_returns_405(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("DELETE", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 405)


if __name__ == "__main__":
    unittest.main()
