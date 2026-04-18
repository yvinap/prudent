import json
import os
import sys
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import api_event, load_lambda, s3_body, s3_error

mod = load_lambda("budgets")

USER_ID = "user-123"
ACCOUNT_ID = "acct-456"
BUDGET_ID = "budget-789"

_EXISTING_BUDGET = {
    "id": BUDGET_ID,
    "accountId": ACCOUNT_ID,
    "name": "Monthly Food",
    "type": "spending",
    "period": "month",
    "amount": 300.0,
    "currency": "USD",
    "categoryId": "cat-1",
    "tagId": None,
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
}

_VALID_BODY = {
    "name": "Monthly Food",
    "type": "spending",
    "period": "month",
    "amount": 300.0,
    "currency": "USD",
    "categoryId": "cat-1",
}


class TestBudgetsHandler(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    def _user(self):
        return s3_body({"accountId": ACCOUNT_ID})

    # ------------------------------------------------------------------
    # POST – create
    # ------------------------------------------------------------------

    def test_create_with_category_returns_201(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(api_event("POST", _VALID_BODY, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        body = json.loads(resp["body"])
        self.assertEqual(body["name"], "Monthly Food")
        self.assertEqual(body["categoryId"], "cat-1")
        self.assertIsNone(body["tagId"])

    def test_create_with_tag_returns_201(self):
        body = {**_VALID_BODY, "categoryId": None, "tagId": "tag-1"}
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(api_event("POST", body, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        result = json.loads(resp["body"])
        self.assertEqual(result["tagId"], "tag-1")
        self.assertIsNone(result["categoryId"])

    def test_create_both_scopes_returns_400(self):
        body = {**_VALID_BODY, "tagId": "tag-1"}
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", body, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_neither_scope_returns_400(self):
        body = {**_VALID_BODY, "categoryId": None}
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", body, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_missing_name_returns_400(self):
        body = {k: v for k, v in _VALID_BODY.items() if k != "name"}
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", body, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_invalid_type_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {**_VALID_BODY, "type": "unknown"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_invalid_period_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {**_VALID_BODY, "period": "week"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_zero_amount_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {**_VALID_BODY, "amount": 0}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_negative_amount_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {**_VALID_BODY, "amount": -50}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_uppercases_currency(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(api_event("POST", {**_VALID_BODY, "currency": "usd"}, user_id=USER_ID), None)
        self.assertEqual(json.loads(resp["body"])["currency"], "USD")

    # ------------------------------------------------------------------
    # PUT – update
    # ------------------------------------------------------------------

    def test_update_returns_200_with_new_amount(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_BUDGET])]
        resp = mod.handler(
            api_event("PUT", {"amount": 500.0}, path_params={"budgetId": BUDGET_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"])["amount"], 500.0)

    def test_update_not_found_returns_404(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(
            api_event("PUT", {"amount": 100}, path_params={"budgetId": "nonexistent"}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 404)

    def test_update_clearing_category_without_setting_tag_returns_400(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_BUDGET])]
        resp = mod.handler(
            api_event("PUT", {"categoryId": None}, path_params={"budgetId": BUDGET_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 400)

    def test_update_switch_scope_from_category_to_tag(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_BUDGET])]
        resp = mod.handler(
            api_event(
                "PUT",
                {"categoryId": None, "tagId": "tag-1"},
                path_params={"budgetId": BUDGET_ID},
                user_id=USER_ID,
            ),
            None,
        )
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertIsNone(body["categoryId"])
        self.assertEqual(body["tagId"], "tag-1")

    def test_update_omitted_fields_unchanged(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_BUDGET])]
        resp = mod.handler(
            api_event("PUT", {"name": "New Name"}, path_params={"budgetId": BUDGET_ID}, user_id=USER_ID), None
        )
        body = json.loads(resp["body"])
        self.assertEqual(body["type"], "spending")
        self.assertEqual(body["amount"], 300.0)

    # ------------------------------------------------------------------
    # General
    # ------------------------------------------------------------------

    def test_unsupported_method_returns_405(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("DELETE", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 405)


if __name__ == "__main__":
    unittest.main()
