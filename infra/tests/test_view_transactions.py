import json
import os
import sys
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import api_event, load_lambda, s3_body, s3_error

mod = load_lambda("transactions", "view_transactions.py")

USER_ID = "user-123"
ACCOUNT_ID = "acct-456"

_TXN_A = {"id": "t1", "accountId": ACCOUNT_ID, "createdAt": "2026-04-10T08:00:00Z", "amount": 5.0}
_TXN_B = {"id": "t2", "accountId": ACCOUNT_ID, "createdAt": "2026-04-10T18:00:00Z", "amount": 12.0}
_TXN_C = {"id": "t3", "accountId": ACCOUNT_ID, "createdAt": "2026-04-11T09:00:00Z", "amount": 3.0}


class TestViewTransactions(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    def _user(self):
        return s3_body({"accountId": ACCOUNT_ID})

    # ------------------------------------------------------------------
    # Single day
    # ------------------------------------------------------------------

    def test_returns_transactions_for_specific_day(self):
        self.s3.get_object.side_effect = [self._user(), s3_body([_TXN_A, _TXN_B])]
        resp = mod.handler(api_event("GET", query_params={"year": "2026", "month": "04", "date": "10"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertEqual(len(body), 2)

    def test_returns_empty_list_when_day_file_not_found(self):
        self.s3.get_object.side_effect = [self._user(), s3_error("NoSuchKey")]
        resp = mod.handler(api_event("GET", query_params={"year": "2026", "month": "04", "date": "10"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"]), [])

    # ------------------------------------------------------------------
    # Full month (paginator)
    # ------------------------------------------------------------------

    def test_returns_sorted_transactions_for_month(self):
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [
            {
                "Contents": [
                    {"Key": f"Transactions/{ACCOUNT_ID}/2026/04/11.json"},
                    {"Key": f"Transactions/{ACCOUNT_ID}/2026/04/10.json"},
                ]
            }
        ]
        self.s3.get_paginator.return_value = mock_paginator
        # user get_object + two day file get_objects
        self.s3.get_object.side_effect = [
            self._user(),
            s3_body([_TXN_C]),   # day 11
            s3_body([_TXN_A, _TXN_B]),  # day 10
        ]
        resp = mod.handler(api_event("GET", query_params={"year": "2026", "month": "04"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertEqual(len(body), 3)
        # sorted chronologically
        self.assertEqual(body[0]["id"], "t1")
        self.assertEqual(body[2]["id"], "t3")

    def test_returns_empty_list_when_no_files_in_month(self):
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [{}]  # no Contents key
        self.s3.get_paginator.return_value = mock_paginator
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("GET", query_params={"year": "2026", "month": "04"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(json.loads(resp["body"]), [])

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def test_non_numeric_year_returns_400(self):
        resp = mod.handler(api_event("GET", query_params={"year": "twenty26", "month": "04"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_non_numeric_month_returns_400(self):
        resp = mod.handler(api_event("GET", query_params={"year": "2026", "month": "april"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)

    def test_non_numeric_date_returns_400(self):
        resp = mod.handler(api_event("GET", query_params={"year": "2026", "month": "04", "date": "fri"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)


if __name__ == "__main__":
    unittest.main()
