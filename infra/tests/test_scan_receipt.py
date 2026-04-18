import json
import os
import sys
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("S3_BUCKET", "test-bucket")
sys.path.insert(0, os.path.dirname(__file__))

from helpers import api_event, load_lambda, s3_body, s3_error

mod = load_lambda("receipts", "scan_receipt.py")

USER_ID = "user-123"
ACCOUNT_ID = "acct-456"


class TestScanReceipt(unittest.TestCase):

    def setUp(self):
        self.s3 = MagicMock()
        mod.s3 = self.s3

    def _user(self):
        return s3_body({"accountId": ACCOUNT_ID})

    # ------------------------------------------------------------------
    # Happy path
    # ------------------------------------------------------------------

    def test_returns_200_with_receipt_and_upload_url(self):
        self.s3.get_object.return_value = self._user()
        self.s3.generate_presigned_url.return_value = "https://s3.example.com/presigned"
        resp = mod.handler(api_event("POST", {"contentType": "image/jpeg"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 200)
        body = json.loads(resp["body"])
        self.assertIn("receipt", body)
        self.assertIn("uploadUrl", body)
        self.assertEqual(body["uploadUrl"], "https://s3.example.com/presigned")

    def test_receipt_record_has_correct_fields(self):
        self.s3.get_object.return_value = self._user()
        self.s3.generate_presigned_url.return_value = "https://example.com/url"
        resp = mod.handler(api_event("POST", {"contentType": "image/png"}, user_id=USER_ID), None)
        receipt = json.loads(resp["body"])["receipt"]
        self.assertEqual(receipt["accountId"], ACCOUNT_ID)
        self.assertEqual(receipt["uploadedBy"], USER_ID)
        self.assertEqual(receipt["status"], "uploaded")
        self.assertEqual(receipt["transactionIds"], [])
        self.assertIn("id", receipt)
        self.assertIn(".png", receipt["s3Key"])

    def test_defaults_to_jpeg_content_type_when_omitted(self):
        self.s3.get_object.return_value = self._user()
        self.s3.generate_presigned_url.return_value = "https://example.com/url"
        resp = mod.handler(api_event("POST", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 200)
        receipt = json.loads(resp["body"])["receipt"]
        self.assertIn(".jpg", receipt["s3Key"])

    def test_presigned_url_put_object_is_called_with_correct_content_type(self):
        self.s3.get_object.return_value = self._user()
        self.s3.generate_presigned_url.return_value = "https://example.com/url"
        mod.handler(api_event("POST", {"contentType": "image/png"}, user_id=USER_ID), None)
        call_kwargs = self.s3.generate_presigned_url.call_args
        params = call_kwargs[1]["Params"] if call_kwargs[1] else call_kwargs[0][1]
        self.assertEqual(params["ContentType"], "image/png")

    def test_receipt_metadata_is_saved_to_s3(self):
        self.s3.get_object.return_value = self._user()
        self.s3.generate_presigned_url.return_value = "https://example.com/url"
        mod.handler(api_event("POST", {}, user_id=USER_ID), None)
        self.s3.put_object.assert_called_once()
        saved = json.loads(self.s3.put_object.call_args.kwargs["Body"])
        self.assertEqual(saved["status"], "uploaded")

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def test_invalid_content_type_returns_400(self):
        self.s3.get_object.return_value = self._user()
        resp = mod.handler(api_event("POST", {"contentType": "text/plain"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 400)
        self.assertIn("contentType", json.loads(resp["body"])["error"])

    def test_user_not_found_returns_404(self):
        self.s3.get_object.side_effect = s3_error("NoSuchKey")
        resp = mod.handler(api_event("POST", {}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 404)

    def test_invalid_json_body_returns_400(self):
        event = api_event("POST", user_id=USER_ID)
        event["body"] = "not-json"
        resp = mod.handler(event, None)
        self.assertEqual(resp["statusCode"], 400)

    def test_pdf_content_type_is_accepted(self):
        self.s3.get_object.return_value = self._user()
        self.s3.generate_presigned_url.return_value = "https://example.com/url"
        resp = mod.handler(api_event("POST", {"contentType": "application/pdf"}, user_id=USER_ID), None)
        self.assertEqual(resp["statusCode"], 200)
        self.assertIn(".pdf", json.loads(resp["body"])["receipt"]["s3Key"])


if __name__ == "__main__":
    unittest.main()
