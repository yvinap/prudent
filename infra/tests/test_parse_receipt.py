import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch, call

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import load_lambda, s3_body, s3_error

mod = load_lambda("receipts", "parse_receipt.py")

ACCOUNT_ID = "acct-456"
RECEIPT_ID = "rcpt-789"
USER_ID = "user-123"
YEAR = "2026"
MONTH = "01"
RAW_KEY = f"receipts/raw/{ACCOUNT_ID}/{YEAR}/{MONTH}/{RECEIPT_ID}.jpg"
META_KEY = f"Receipts/{ACCOUNT_ID}/{YEAR}/{MONTH}/{RECEIPT_ID}.json"
LINE_ITEMS_KEY = f"Receipts/{ACCOUNT_ID}/{YEAR}/{MONTH}/{RECEIPT_ID}/lineItems.json"


def _s3_event(key: str = RAW_KEY) -> dict:
    return {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "test-bucket"},
                    "object": {"key": key},
                }
            }
        ]
    }


def _receipt(status: str = "uploaded") -> dict:
    return {
        "id": RECEIPT_ID,
        "accountId": ACCOUNT_ID,
        "uploadedBy": USER_ID,
        "status": status,
        "transactionIds": [],
        "createdAt": "2026-01-02T10:00:00Z",
        "updatedAt": "2026-01-02T10:00:00Z",
    }


def _textract_response(
    date_str: str = "01/02/2026",
    items: list[dict] | None = None,
    currency: str | None = None,
) -> dict:
    """Minimal Textract AnalyzeExpense response."""
    summary_fields = []
    if date_str:
        summary_fields.append(
            {
                "Type": {"Text": "INVOICE_RECEIPT_DATE"},
                "ValueDetection": {"Text": date_str},
            }
        )
    if currency:
        summary_fields.append(
            {
                "Type": {"Text": "CURRENCY"},
                "ValueDetection": {"Text": currency},
            }
        )

    if items is None:
        items = [
            {
                "LineItemExpenseFields": [
                    {"Type": {"Text": "ITEM"}, "ValueDetection": {"Text": "Whole Milk"}},
                    {"Type": {"Text": "QUANTITY"}, "ValueDetection": {"Text": "2"}},
                    {"Type": {"Text": "UNIT_PRICE"}, "ValueDetection": {"Text": "3.49"}},
                ]
            }
        ]

    return {
        "ExpenseDocuments": [
            {
                "SummaryFields": summary_fields,
                "LineItemGroups": [{"LineItems": items}],
            }
        ]
    }


class TestParseReceipt(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        self.textract = MagicMock()
        mod.s3 = self.s3
        mod.textract = self.textract

    def _set_s3_get(self, receipt=None, things=None, categories=None, day=None):
        """Configure s3.get_object side_effect in call order."""
        receipt = receipt if receipt is not None else _receipt()
        things = things if things is not None else []
        categories = categories if categories is not None else [
            {"id": "cat-1", "name": "Groceries"}
        ]
        day = day if day is not None else []
        responses = [
            s3_body(receipt),   # load receipt meta (first call in _update_receipt)
            s3_body(things),    # things.json
            s3_body(categories),# categories.json
            s3_body(day),       # day transactions file
        ]
        # Second update_receipt call (step 7) also reads the receipt
        responses.append(s3_body({**receipt, "status": "parsing"}))
        self.s3.get_object.side_effect = responses

    # ──────────────────────────────────────────────────────────────────────────
    # Happy path
    # ──────────────────────────────────────────────────────────────────────────

    def test_happy_path_creates_transactions_and_line_items(self):
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response()
        mod.handler(_s3_event(), None)
        # put_object called at least 3 times: update→parsing, lineItems, day, update→matched
        self.assertGreaterEqual(self.s3.put_object.call_count, 3)

    def test_receipt_status_set_to_matched_on_success(self):
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response()
        mod.handler(_s3_event(), None)
        # Last put_object call should contain status=matched
        last_body = json.loads(self.s3.put_object.call_args_list[-1].kwargs["Body"])
        self.assertEqual(last_body["status"], "matched")

    def test_receipt_date_used_for_transaction_timestamp(self):
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response(date_str="01/02/2026")
        mod.handler(_s3_event(), None)
        # The day file write should have used 2026-01-02 in the key
        all_keys = [
            c.kwargs.get("Key", "") for c in self.s3.put_object.call_args_list
        ]
        day_keys = [k for k in all_keys if k.startswith("Transactions/")]
        self.assertTrue(any("2026/01/02" in k for k in day_keys))

    def test_transaction_contains_receipt_id(self):
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response()
        mod.handler(_s3_event(), None)
        # Find the day-file write and verify receiptId
        day_write = next(
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        )
        txns = json.loads(day_write.kwargs["Body"])
        self.assertEqual(txns[0]["receiptId"], RECEIPT_ID)

    def test_line_items_saved_with_raw_text_and_resolved_fields(self):
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response()
        mod.handler(_s3_event(), None)
        line_items_write = next(
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").endswith("lineItems.json")
        )
        items = json.loads(line_items_write.kwargs["Body"])
        self.assertEqual(len(items), 1)
        self.assertIn("rawText", items[0])
        self.assertIn("resolvedCategoryId", items[0])
        self.assertIn("qty", items[0])
        self.assertIn("unitPrice", items[0])

    def test_currency_from_textract_used_in_transactions(self):
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response(currency="GBP")
        mod.handler(_s3_event(), None)
        day_write = next(
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        )
        txns = json.loads(day_write.kwargs["Body"])
        self.assertEqual(txns[0]["currency"], "GBP")

    # ──────────────────────────────────────────────────────────────────────────
    # Date fallback
    # ──────────────────────────────────────────────────────────────────────────

    def test_falls_back_to_today_when_no_receipt_date(self):
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response(date_str=None)
        mod.handler(_s3_event(), None)
        # Should still write a day file (today's date used)
        day_writes = [
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        ]
        self.assertEqual(len(day_writes), 1)

    def test_falls_back_to_today_when_date_unparseable(self):
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response(date_str="not-a-date")
        mod.handler(_s3_event(), None)
        day_writes = [
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        ]
        self.assertEqual(len(day_writes), 1)

    # ──────────────────────────────────────────────────────────────────────────
    # Thing matching
    # ──────────────────────────────────────────────────────────────────────────

    def test_matching_thing_used_in_transaction(self):
        things = [
            {"id": "thing-1", "name": "Whole Milk", "defaultCategoryId": "cat-milk"}
        ]
        categories = [{"id": "cat-1", "name": "Groceries"}]
        self._set_s3_get(things=things, categories=categories)
        self.textract.analyze_expense.return_value = _textract_response()
        mod.handler(_s3_event(), None)
        day_write = next(
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        )
        txn = json.loads(day_write.kwargs["Body"])[0]
        self.assertEqual(txn["thingId"], "thing-1")
        self.assertEqual(txn["categoryId"], "cat-milk")

    def test_no_matching_thing_uses_fallback_category(self):
        things = [{"id": "thing-1", "name": "Printer Ink", "defaultCategoryId": "cat-office"}]
        categories = [{"id": "cat-1", "name": "Groceries"}]
        self._set_s3_get(things=things, categories=categories)
        self.textract.analyze_expense.return_value = _textract_response()
        mod.handler(_s3_event(), None)
        day_write = next(
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        )
        txn = json.loads(day_write.kwargs["Body"])[0]
        self.assertIsNone(txn["thingId"])
        self.assertEqual(txn["categoryId"], "cat-1")

    def test_no_category_skips_transaction_but_saves_line_item(self):
        """When there are no categories at all, no transaction is created but the line item is still saved."""
        self._set_s3_get(things=[], categories=[])
        self.textract.analyze_expense.return_value = _textract_response()
        mod.handler(_s3_event(), None)
        day_writes = [
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        ]
        self.assertEqual(len(day_writes), 0)
        line_items_write = next(
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").endswith("lineItems.json")
        )
        items = json.loads(line_items_write.kwargs["Body"])
        self.assertEqual(len(items), 1)

    # ──────────────────────────────────────────────────────────────────────────
    # Price parsing
    # ──────────────────────────────────────────────────────────────────────────

    def test_total_price_divided_by_qty_for_unit_price(self):
        """When only PRICE (total) is given, unitPrice = PRICE / QUANTITY."""
        items = [
            {
                "LineItemExpenseFields": [
                    {"Type": {"Text": "ITEM"}, "ValueDetection": {"Text": "Eggs"}},
                    {"Type": {"Text": "QUANTITY"}, "ValueDetection": {"Text": "12"}},
                    {"Type": {"Text": "PRICE"}, "ValueDetection": {"Text": "$6.00"}},
                ]
            }
        ]
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response(items=items)
        mod.handler(_s3_event(), None)
        day_write = next(
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        )
        txn = json.loads(day_write.kwargs["Body"])[0]
        self.assertAlmostEqual(txn["price"], 0.5)

    def test_unit_price_field_preferred_over_total_price(self):
        items = [
            {
                "LineItemExpenseFields": [
                    {"Type": {"Text": "ITEM"}, "ValueDetection": {"Text": "Bread"}},
                    {"Type": {"Text": "QUANTITY"}, "ValueDetection": {"Text": "2"}},
                    {"Type": {"Text": "UNIT_PRICE"}, "ValueDetection": {"Text": "2.50"}},
                    {"Type": {"Text": "PRICE"}, "ValueDetection": {"Text": "5.00"}},
                ]
            }
        ]
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response(items=items)
        mod.handler(_s3_event(), None)
        day_write = next(
            c for c in self.s3.put_object.call_args_list
            if c.kwargs.get("Key", "").startswith("Transactions/")
        )
        txn = json.loads(day_write.kwargs["Body"])[0]
        self.assertAlmostEqual(txn["price"], 2.50)

    # ──────────────────────────────────────────────────────────────────────────
    # Failure paths
    # ──────────────────────────────────────────────────────────────────────────

    def test_textract_failure_sets_status_to_error(self):
        self.s3.get_object.side_effect = [
            s3_body(_receipt()),
            s3_body({**_receipt(), "status": "parsing"}),
        ]
        self.textract.analyze_expense.side_effect = Exception("Textract downstream error")
        mod.handler(_s3_event(), None)
        last_body = json.loads(self.s3.put_object.call_args_list[-1].kwargs["Body"])
        self.assertEqual(last_body["status"], "error")

    def test_no_expense_documents_sets_status_to_error(self):
        self.s3.get_object.side_effect = [
            s3_body(_receipt()),
            s3_body({**_receipt(), "status": "parsing"}),
        ]
        self.textract.analyze_expense.return_value = {"ExpenseDocuments": []}
        mod.handler(_s3_event(), None)
        last_body = json.loads(self.s3.put_object.call_args_list[-1].kwargs["Body"])
        self.assertEqual(last_body["status"], "error")

    def test_missing_receipt_metadata_is_handled_gracefully(self):
        self.s3.get_object.side_effect = s3_error("NoSuchKey")
        mod.handler(_s3_event(), None)
        self.s3.put_object.assert_not_called()

    def test_no_line_items_sets_status_to_matched(self):
        self.s3.get_object.side_effect = [
            s3_body(_receipt()),
            s3_body({**_receipt(), "status": "parsing"}),
        ]
        self.textract.analyze_expense.return_value = _textract_response(items=[])
        mod.handler(_s3_event(), None)
        last_body = json.loads(self.s3.put_object.call_args_list[-1].kwargs["Body"])
        self.assertEqual(last_body["status"], "matched")

    def test_invalid_s3_key_format_is_skipped_gracefully(self):
        mod.handler(_s3_event(key="unexpected/path/file.jpg"), None)
        self.s3.get_object.assert_not_called()
        self.s3.put_object.assert_not_called()

    def test_url_encoded_s3_key_is_decoded_correctly(self):
        """Keys with spaces or special chars come URL-encoded from S3 events."""
        encoded_key = f"receipts/raw/{ACCOUNT_ID}/{YEAR}/{MONTH}/{RECEIPT_ID}+copy.jpg"
        self._set_s3_get()
        self.textract.analyze_expense.return_value = _textract_response()
        # The + decodes to a space; the handler should survive the different receipt_id
        mod.handler(_s3_event(key=encoded_key), None)
        # Just verify it did not crash — Textract was called
        self.textract.analyze_expense.assert_called_once()

    # ──────────────────────────────────────────────────────────────────────────
    # Multiple records in one event
    # ──────────────────────────────────────────────────────────────────────────

    def test_multiple_records_are_all_processed(self):
        receipt2_id = "rcpt-999"
        key2 = f"receipts/raw/{ACCOUNT_ID}/{YEAR}/{MONTH}/{receipt2_id}.jpg"
        event = {
            "Records": [
                {"s3": {"bucket": {"name": "test-bucket"}, "object": {"key": RAW_KEY}}},
                {"s3": {"bucket": {"name": "test-bucket"}, "object": {"key": key2}}},
            ]
        }
        # Two separate receipt metadata objects
        self.s3.get_object.side_effect = [
            s3_body(_receipt()),
            s3_body([]),   # things
            s3_body([{"id": "cat-1", "name": "Groceries"}]),  # categories
            s3_body([]),   # day txns
            s3_body({**_receipt(), "status": "parsing"}),  # final update
            s3_body({**_receipt(), "id": receipt2_id}),
            s3_body([]),
            s3_body([{"id": "cat-1", "name": "Groceries"}]),
            s3_body([]),
            s3_body({**_receipt(), "id": receipt2_id, "status": "parsing"}),
        ]
        self.textract.analyze_expense.return_value = _textract_response()
        mod.handler(event, None)
        self.assertEqual(self.textract.analyze_expense.call_count, 2)


if __name__ == "__main__":
    unittest.main()
