# Prudent

Prudent is a personal expense tracking application for individuals and shared (family) accounts. Users sign in with Google, capture transactions manually or by scanning receipts, classify them with categories/tags/things, and track spending against monthly budgets.

The product domain is `prudigo.com`.

## Repository Layout

| Path | Purpose |
|------|---------|
| [app/](app/) | Production React + Vite single-page application (Mantine UI, AWS Amplify auth). |
| [infra/](infra/) | AWS CDK (Python) infrastructure: Cognito, API Gateway, Lambda, S3, CloudFront. |
| [DataModel/](DataModel/DataModel.md) | Canonical S3 data model — folder layout and entity schemas. |
| [wireframes/](wireframes/) | Static React wireframes used during design. Not deployed. |
| [adrs/](adrs/) | Architecture Decision Records. |

## High-Level Flow

```
                            ┌───────────────────────┐
                            │      Google OAuth     │
                            └──────────┬────────────┘
                                       │ ID token
                                       ▼
┌──────────┐   HTTPS    ┌─────────────────────────┐    JWT     ┌──────────────────┐
│  Browser │──────────▶ │  CloudFront → S3 (SPA)  │            │  Cognito User    │
│  (React) │ ◀───────── │  prudigo.com            │ ◀───────── │  Pool + Hosted UI│
└────┬─────┘            └─────────────────────────┘            └────────┬─────────┘
     │                                                                  │
     │ Bearer JWT                                                       │ PostAuth trigger
     ▼                                                                  ▼
┌─────────────────────┐    ┌──────────────────────────┐     ┌────────────────────┐
│  API Gateway (REST) │───▶│  Lambda functions        │────▶│  S3 (prudent-data) │
│  Cognito Authorizer │    │  things / categories /   │     │  Metadata/         │
└─────────────────────┘    │  tags / budgets /        │     │  Transactions/     │
                           │  transactions / receipts │     │  Receipts/         │
                           └──────────────────────────┘     │  AuditLogs/        │
                                                            └────────────────────┘
```

### End-to-end request flow

1. **Authentication.** The SPA redirects to the Cognito Hosted UI which federates to Google. On first sign-in, the Cognito `PostAuthentication` trigger (`prudent-register-user`) creates the user's personal account and seeds default categories in S3.
2. **API calls.** The SPA calls API Gateway with the Cognito-issued JWT in the `Authorization` header. A `CognitoUserPoolsAuthorizer` validates the token before any Lambda runs.
3. **Read/write.** Each Lambda reads/writes a single aggregated JSON document in S3 (e.g. one `things.json` per account, one `{year}.json` per account for transactions). See [DataModel/DataModel.md](DataModel/DataModel.md).
4. **Receipts.** `POST /receipts` returns a presigned PUT URL; the browser uploads the image directly to S3, and a parser Lambda extracts line items.
5. **Static hosting.** The React build is deployed to a private S3 bucket fronted by CloudFront with an SPA fallback (404/403 → `/index.html`).

### Core data flows

- **Sign in →** Google → Cognito → SPA receives JWT → `GET /me` returns user + accounts.
- **Add transaction →** `POST /transactions` → Lambda GETs `{year}.json`, appends, PUTs back.
- **Scan receipt →** `POST /receipts` (returns presigned URL) → browser PUTs image → parser extracts items → `POST /transactions`.
- **View transactions →** `GET /transactions?year=YYYY` → 1 S3 GET → return month/day-keyed map.
- **Share account →** invite email containing a token; on first login the SPA calls `acceptInvite` and the user is added as a secondary owner.

## Getting Started

```bash
# Frontend
cd app && npm install && npm run dev

# Infra (deploy)
cd infra && pip install -r requirements.txt && cdk deploy --all

# Tests
cd infra && pytest
```

See [app/README.md](app/README.md) and [infra/README.md](infra/README.md) for component-specific details.

## Architecture Decisions

Key decisions are recorded as ADRs in [adrs/](adrs/):

- [ADR-0001](adrs/0001-serverless-aws-stack.md) — Serverless AWS stack
- [ADR-0002](adrs/0002-s3-as-primary-datastore.md) — S3 as primary datastore (no database)
- [ADR-0003](adrs/0003-aggregated-json-storage.md) — Aggregated JSON storage layout
- [ADR-0004](adrs/0004-google-only-auth-via-cognito.md) — Google-only authentication via Cognito
- [ADR-0005](adrs/0005-react-vite-mantine-frontend.md) — React + Vite + Mantine for the SPA
- [ADR-0006](adrs/0006-cloudfront-spa-hosting.md) — CloudFront + S3 for SPA hosting
- [ADR-0007](adrs/0007-presigned-url-receipt-upload.md) — Presigned URL receipt upload

## License

Prudent is free software released under the [GNU General Public License v3.0](LICENSE) or later.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [LICENSE](LICENSE) file for the full terms.
