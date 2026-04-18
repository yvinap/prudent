import json
import os
import sys
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import api_event, load_lambda, s3_body, s3_error

mod = load_lambda("categories")

USER_ID = "user-123"
ACCOUNT_ID = "acct-456"
CAT_ID = "cat-789"

_EXISTING_CAT = {
    "id": CAT_ID,
    "accountId": ACCOUNT_ID,
    "name": "Food",
    "icon": "🍔",
    "color": "#f97316",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
}


class TestCategoriesHandler(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    def _user(self):
        return s3_body({"accountId": ACCOUNT_ID})

    # ------------------------------------------------------------------
    # POST – create
    # ------------------------------------------------------------------

    def test_create_returns_201_with_new_category(self):
        self.s3.get_object.side_effect = [self._user(), s3_error()]
        resp = mod.handler(api_event("POST", {"name": "Food", "icon": "🍔", "color": "#f97316"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        body = json.loads(resp["body"])
        self.assertEqual(body["name"], "Food")
        self.assertEqual(body["icon"], "🍔")
        self.assertEqual(body["color"], "#f97316")

    def test_create_applies_default_color_when_omitted(self):
        self.s3.get_object.side_effect = [self._user(), s3_error()]
        resp = mod.handler(api_event("POST", {"name": "Food"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        self.assertIsNotNone(json.loads(resp["body"])["color"])

    def test_create_missing_name_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_appends_to_existing_categories(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_CAT])]
        mod.handler(api_event("POST", {"name": "Transport"}, user_id=USER_ID), None)
        saved = json.loads(self.s3.put_object.call_args.kwargs["Body"])
        self.assertEqual(len(saved), 2)

    # ------------------------------------------------------------------
    # PUT – update
    # ------------------------------------------------------------------

    def test_update_returns_200_with_new_name(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_CAT])]
        resp = mod.handler(
            api_event("PUT", {"name": "Groceries"}, path_params={"categoryId": CAT_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"])["name"], "Groceries")

    def test_update_icon_and_color(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_CAT])]
        resp = mod.handler(
            api_event("PUT", {"icon": "🛒", "color": "#00ff00"}, path_params={"categoryId": CAT_ID}, user_id=USER_ID),
            None,
        )
        body = json.loads(resp["body"])
        self.assertEqual(body["icon"], "🛒")
        self.assertEqual(body["color"], "#00ff00")

    def test_update_not_found_returns_404(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(
            api_event("PUT", {"name": "X"}, path_params={"categoryId": "missing"}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 404)

    def test_update_empty_name_returns_400(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_CAT])]
        resp = mod.handler(
            api_event("PUT", {"name": ""}, path_params={"categoryId": CAT_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 400)

    def test_update_omitted_fields_are_unchanged(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_CAT])]
        resp = mod.handler(
            api_event("PUT", {"icon": "✈️"}, path_params={"categoryId": CAT_ID}, user_id=USER_ID), None
        )
        body = json.loads(resp["body"])
        # name and color unchanged
        self.assertEqual(body["name"], "Food")
        self.assertEqual(body["color"], "#f97316")

    # ------------------------------------------------------------------
    # General
    # ------------------------------------------------------------------

    def test_unsupported_method_returns_405(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("DELETE", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 405)


if __name__ == "__main__":
    unittest.main()
