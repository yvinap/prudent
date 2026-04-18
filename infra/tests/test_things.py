import json
import os
import sys
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import api_event, load_lambda, s3_body, s3_error

mod = load_lambda("things")

USER_ID = "user-123"
ACCOUNT_ID = "acct-456"
THING_ID = "thing-789"

_EXISTING_THING = {
    "id": THING_ID,
    "accountId": ACCOUNT_ID,
    "name": "Whole Milk",
    "defaultCategoryId": None,
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
}


class TestThingsHandler(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    def _user(self):
        return s3_body({"accountId": ACCOUNT_ID})

    # ------------------------------------------------------------------
    # POST – create
    # ------------------------------------------------------------------

    def test_create_returns_201_with_new_thing(self):
        self.s3.get_object.side_effect = [self._user(), s3_error()]  # no existing things
        resp = mod.handler(api_event("POST", {"name": "Whole Milk"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        body = json.loads(resp["body"])
        self.assertEqual(body["name"], "Whole Milk")
        self.assertEqual(body["accountId"], ACCOUNT_ID)
        self.assertIn("id", body)

    def test_create_appends_to_existing_things(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_THING])]
        mod.handler(api_event("POST", {"name": "Oat Milk"}, user_id=USER_ID), None)
        saved = json.loads(self.s3.put_object.call_args.kwargs["Body"])
        self.assertEqual(len(saved), 2)
        self.assertEqual(saved[1]["name"], "Oat Milk")

    def test_create_missing_name_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)
        self.assertIn("name", json.loads(resp["body"])["error"])

    def test_create_whitespace_name_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {"name": "   "}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_stores_optional_default_category_id(self):
        self.s3.get_object.side_effect = [self._user(), s3_error()]
        resp = mod.handler(api_event("POST", {"name": "Eggs", "defaultCategoryId": "cat-1"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        self.assertEqual(json.loads(resp["body"])["defaultCategoryId"], "cat-1")

    # ------------------------------------------------------------------
    # PUT – update
    # ------------------------------------------------------------------

    def test_update_returns_200_with_updated_name(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_THING])]
        resp = mod.handler(
            api_event("PUT", {"name": "Skimmed Milk"}, path_params={"thingId": THING_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"])["name"], "Skimmed Milk")

    def test_update_not_found_returns_404(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(
            api_event("PUT", {"name": "X"}, path_params={"thingId": "nonexistent"}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 404)

    def test_update_empty_name_returns_400(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_THING])]
        resp = mod.handler(
            api_event("PUT", {"name": ""}, path_params={"thingId": THING_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 400)

    def test_update_clears_default_category_id_when_null_passed(self):
        thing = {**_EXISTING_THING, "defaultCategoryId": "cat-old"}
        self.s3.get_object.side_effect = [self._user(), s3_body([thing])]
        resp = mod.handler(
            api_event("PUT", {"defaultCategoryId": None}, path_params={"thingId": THING_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 200)
        self.assertIsNone(json.loads(resp["body"])["defaultCategoryId"])

    def test_update_sets_updated_at(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_THING])]
        resp = mod.handler(
            api_event("PUT", {"name": "New Name"}, path_params={"thingId": THING_ID}, user_id=USER_ID), None
        )
        body = json.loads(resp["body"])
        self.assertGreater(body["updatedAt"], body["createdAt"])

    # ------------------------------------------------------------------
    # General handler edge cases
    # ------------------------------------------------------------------

    def test_invalid_json_body_returns_400(self):
        self.s3.get_object.return_value = self._user()
        event = api_event("POST", user_id=USER_ID)
        event["body"] = "not-json"
        resp = mod.handler(event, None)
        self.assertEqual(resp["statusCode"], 400)

    def test_unsupported_method_returns_405(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("DELETE", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 405)

    def test_unknown_user_returns_404(self):
        self.s3.get_object.side_effect = s3_error("NoSuchKey")
        resp = mod.handler(api_event("POST", {"name": "Milk"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 404)


if __name__ == "__main__":
    unittest.main()
