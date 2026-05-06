# ADR 0006: CloudFront + S3 for SPA Hosting

- **Status:** Accepted
- **Date:** 2026-01

## Context

The compiled SPA needs HTTPS hosting on the custom domain `prudigo.com`, with low latency globally and SPA-style client-side routing (deep links must serve `index.html`).

## Decision

- **Origin:** Private S3 bucket (`prudent-frontend-{account}-{region}`) with all public access blocked.
- **CDN:** CloudFront distribution using **Origin Access Control (OAC)** to read from the bucket; no public bucket policy.
- **Routing:** SPA fallback — both `403` and `404` responses from S3 are rewritten to `200 /index.html` so React Router handles deep links.
- **TLS:** ACM certificate in `us-east-1` for `prudigo.com` and `www.prudigo.com`, passed via CDK context (`frontendCertArn`).
- **Deploy:** `s3deploy.BucketDeployment` uploads `app/dist` and triggers a CloudFront invalidation for `/*`.

## Consequences

**Positive**
- Static, globally cached, HTTPS by default.
- Bucket is fully private; only CloudFront can read it.
- SPA fallback supported without Lambda@Edge.
- Cheap: pennies per month at expected traffic.

**Negative**
- Cache invalidation on every deploy adds a small cost and a propagation delay.
- Certificate must live in `us-east-1` (CloudFront constraint), separate from other regional resources.
- SPA fallback also masks legitimate 404s for missing assets — minor.
