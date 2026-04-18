import json
import os
import sys
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import api_event, load_lambda, s3_body, s3_error

mod = load_lambda("transactions")

USER_ID = "user-123"
ACCOUNT_ID = "acct-456"
TXN_ID = "txn-789"

_EXISTING_TXN = {
    "id": TXN_ID,
    "accountId": ACCOUNT_ID,
    "createdBy": USER_ID,
    "thingId": "thing-1",
    "categoryId": None,
    "tagIds": [],
    "qty": 2,
    "price": 3.49,
    "currency": "USD",
    "receiptId": None,
    "receiptLineItemId": None,
    "createdAt": "2026-04-17T10:00:00Z",
    "updatedAt": "2026-04-17T10:00:00Z",
}

_CREATE_BODY = {
    "thingId": "thing-1",
    "qty": 2,
    "price": 3.49,
    "currency": "USD",
}

_UPDATE_BODY = {
    "qty": 5,
    "createdAt": "2026-04-17",
}


class TestTransactionsHandler(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    def _user(self):
        return s3_body({"accountId": ACCOUNT_ID})

    # ------------------------------------------------------------------
    # POST – create
    # ------------------------------------------------------------------

    def test_create_with_thing_only_returns_201(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(api_event("POST", _CREATE_BODY, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        body = json.loads(resp["body"])
        self.assertEqual(body["thingId"], "thing-1")
        self.assertEqual(body["currency"], "USD")
        self.assertIn("id", body)

    def test_create_with_category_only_returns_201(self):
        body = {"categoryId": "cat-1", "qty": 1, "price": 10.0, "currency": "EUR"}
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(api_event("POST", body, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)
        self.assertEqual(json.loads(resp["body"])["categoryId"], "cat-1")

    def test_create_neither_thing_nor_category_returns_400(self):
        body = {"qty": 1, "price": 5.0, "currency": "USD"}
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", body, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_missing_qty_returns_400(self):
        body = {"thingId": "thing-1", "price": 5.0, "currency": "USD"}
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", body, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_zero_qty_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {**_CREATE_BODY, "qty": 0}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_negative_price_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {**_CREATE_BODY, "price": -1}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_create_zero_price_is_allowed(self):
        """A price of 0 is valid (free item)."""
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(api_event("POST", {**_CREATE_BODY, "price": 0}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 201)

    def test_create_appends_to_existing_day_file(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TXN])]
        mod.handler(api_event("POST", _CREATE_BODY, user_id=USER_ID), None)
        saved = json.loads(self.s3.put_object.call_args.kwargs["Body"])
        self.assertEqual(len(saved), 2)

    def test_create_uppercases_currency(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(api_event("POST", {**_CREATE_BODY, "currency": "usd"}, user_id=USER_ID), None)
        self.assertEqual(json.loads(resp["body"])["currency"], "USD")

    def test_create_tag_ids_not_a_list_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {**_CREATE_BODY, "tagIds": "not-a-list"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    # ------------------------------------------------------------------
    # PUT – update
    # ------------------------------------------------------------------

    def test_update_returns_200_with_new_qty(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TXN])]
        resp = mod.handler(
            api_event("PUT", _UPDATE_BODY, path_params={"transactionId": TXN_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"])["qty"], 5)

    def test_update_not_found_returns_404(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([])]
        resp = mod.handler(
            api_event("PUT", _UPDATE_BODY, path_params={"transactionId": "nonexistent"}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 404)

    def test_update_wrong_account_returns_403(self):
        txn_other_account = {**_EXISTING_TXN, "accountId": "other-account"}
        self.s3.get_object.side_effect = [self._user(), s3_body([txn_other_account])]
        resp = mod.handler(
            api_event("PUT", _UPDATE_BODY, path_params={"transactionId": TXN_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 403)

    def test_update_missing_created_at_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(
            api_event("PUT", {"qty": 3}, path_params={"transactionId": TXN_ID}, user_id=USER_ID), None
        )
        self.assertEqual(resp["statusCode"], 400)
        self.assertIn("createdAt", json.loads(resp["body"])["error"])

    def test_update_invalid_created_at_format_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(
            api_event("PUT", {"qty": 3, "createdAt": "17-04-2026"}, path_params={"transactionId": TXN_ID}, user_id=USER_ID),
            None,
        )
        self.assertEqual(resp["statusCode"], 400)

    def test_update_accepts_plain_date_format(self):
        """createdAt as YYYY-MM-DD should be accepted."""
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TXN])]
        resp = mod.handler(
            api_event("PUT", {"qty": 3, "createdAt": "2026-04-17"}, path_params={"transactionId": TXN_ID}, user_id=USER_ID),
            None,
        )
        self.assertEqual(resp["statusCode"], 200)

    def test_update_omitted_fields_unchanged(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_EXISTING_TXN])]
        resp = mod.handler(
            api_event("PUT", {"qty": 10, "createdAt": "2026-04-17"}, path_params={"transactionId": TXN_ID}, user_id=USER_ID),
            None,
        )
        body = json.loads(resp["body"])
        self.assertEqual(body["price"], 3.49)
        self.assertEqual(body["currency"], "USD")

    # ------------------------------------------------------------------
    # General
    # ------------------------------------------------------------------

    def test_unsupported_method_returns_405(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("DELETE", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 405)

    def test_invalid_json_body_returns_400(self):
        self.s3.get_object.return_value = self._user()
        event = api_event("POST", user_id=USER_ID)
        event["body"] = "{bad json"
        resp = mod.handler(event, None)
        self.assertEqual(resp["statusCode"], 400)


if __name__ == "__main__":
    unittest.main()
