# ADR 0007: Presigned URL Receipt Upload

- **Status:** Accepted
- **Date:** 2026-01

## Context

Receipt images can be several megabytes. Sending them as base64 in a JSON body through API Gateway is wasteful, hits the 10 MB API Gateway payload limit, and burns Lambda execution time on byte-shuffling. We want the browser to upload directly to S3 while keeping the operation authenticated and scoped.

## Decision

- The SPA calls `POST /receipts` with metadata (filename, content type).
- The `scan_receipt` Lambda:
  1. Verifies the caller via the Cognito authorizer claims.
  2. Mints a unique `receiptId`.
  3. Generates a **presigned PUT URL** valid for a short window, scoped to `receipts/raw/{accountId}/{receiptId}` in the data bucket.
  4. Returns the URL and the resulting object key to the SPA.
- The browser performs `PUT <presigned URL>` with the image bytes directly — no API Gateway, no Lambda in the upload path.
- The S3 `ObjectCreated` event fires the `parse_receipt` Lambda, which extracts line items and writes the structured receipt JSON.
- The bucket CORS rule allows `PUT` from the SPA origin.

## Consequences

**Positive**
- Large uploads bypass API Gateway and Lambda payload limits.
- Lambda invocation time stays small and cheap.
- Authorization is preserved via the issuing Lambda + URL expiry + path scoping.
- Decouples upload from parsing — parsing failures do not block the user's request.

**Negative**
- Two-step flow on the client (request URL → PUT → wait for parse).
- Bucket needs a CORS policy that allows browser PUTs.
- Presigned URLs cannot enforce content-length or content-type without `Conditions` in a presigned POST; we accept the trade-off and validate after upload in `parse_receipt`.
