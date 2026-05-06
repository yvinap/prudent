# Prudent — Infrastructure (`infra/`)

AWS CDK (Python) application that provisions the entire Prudent backend and the static frontend hosting.

## Stacks

| Stack | File | Resources |
|-------|------|-----------|
| `PrudentBackendStack` | [backend_stack.py](backend_stack.py) | S3 data bucket, Cognito User Pool + Google IdP, API Gateway, all Lambda functions, IAM roles. |
| `PrudentFrontendStack` | [frontend_stack.py](frontend_stack.py) | Frontend S3 bucket, CloudFront distribution, ACM certificate binding, deployment of `app/dist`. |

## Project Layout

```
infra/
├── app.py                  # CDK app entry
├── backend_stack.py        # API + data + auth
├── frontend_stack.py       # CloudFront + S3 SPA hosting
├── cdk.json
├── requirements.txt
├── lambdas/
│   ├── auth/
│   │   ├── register_user.py     # Cognito PostAuthentication trigger
│   │   └── get_user.py          # GET /me
│   ├── things/handler.py        # GET/POST/PUT /things
│   ├── categories/handler.py    # GET/POST/PUT /categories
│   ├── tags/handler.py          # GET/POST/PUT /tags
│   ├── budgets/handler.py       # GET/POST/PUT /budgets
│   ├── transactions/
│   │   ├── handler.py           # POST/PUT /transactions
│   │   └── view_transactions.py # GET /transactions
│   ├── receipts/
│   │   ├── scan_receipt.py      # POST /receipts (presigned URL)
│   │   └── parse_receipt.py     # S3-triggered receipt parser
│   ├── invites/handler.py
│   └── accounts/handler.py
└── tests/                       # pytest suite for every handler
```

## High-Level Flow

```
                         ┌─────────────────────────┐
                         │   Cognito User Pool     │
                         │   (Google IdP only)     │
                         └──────────┬──────────────┘
                                    │ PostAuth trigger
                                    ▼
                         ┌─────────────────────────┐
                         │  register_user Lambda   │
                         │  • create user          │
                         │  • create personal acct │
                         │  • seed default cats    │
                         └──────────┬──────────────┘
                                    │
                                    ▼
                         ┌─────────────────────────┐
                         │   S3: prudent-data      │
                         │   Metadata/, Trans-     │
                         │   actions/, Receipts/,  │
                         │   AuditLogs/            │
                         └──────────▲──────────────┘
                                    │
   ┌────────┐  JWT   ┌────────────┐ │  ┌───────────────────────────┐
   │ SPA    │──────▶ │ API Gateway│─┼─▶│ Lambdas:                  │
   │ (app/) │        │ + Cognito  │ │  │  things, categories, tags,│
   │        │ ◀──────│ Authorizer │ │  │  budgets, transactions,   │
   └────────┘        └────────────┘ │  │  receipts, invites        │
                                    │  └───────────────────────────┘
                                    │
   ┌────────┐                       │
   │ Browser│── PUT presigned ──────┘
   │  image │
   └────────┘
```

### Request lifecycle

1. **Authorize.** API Gateway runs the `CognitoUserPoolsAuthorizer` against the `Authorization` header. Failure returns 401 before any Lambda is invoked.
2. **Resolve user.** Each Lambda extracts `sub` and `email` from `event.requestContext.authorizer.claims` and uses them to locate the user record in `Metadata/users/{userId}.json`.
3. **Read–modify–write.** Aggregated documents (`things.json`, `tags.json`, `categories.json`, `budgets.json`, `{year}.json`) are GET-modified-PUT in a single Lambda invocation. See [../DataModel/DataModel.md](../DataModel/DataModel.md).
4. **Audit.** Mutating handlers append a record to `AuditLogs/{userId}/{year}/{month}/{date}.json`.
5. **Receipt upload.** `scan_receipt` returns a presigned PUT URL scoped to `receipts/raw/*`; the browser uploads directly. The S3 `ObjectCreated` event invokes `parse_receipt`, which extracts line items via Textract/Bedrock and writes them to `Receipts/{accountId}/{year}/{month}/{receiptId}.json`.

## Routes (API Gateway)

| Method | Path | Lambda |
|--------|------|--------|
| GET | `/me` | `get_user` |
| GET / POST | `/things`, `/things/{id}` (PUT) | `things` |
| GET / POST | `/categories`, `/categories/{id}` (PUT) | `categories` |
| GET / POST | `/tags`, `/tags/{id}` (PUT) | `tags` |
| GET / POST | `/budgets`, `/budgets/{id}` (PUT) | `budgets` |
| POST / PUT | `/transactions`, `/transactions/{id}` | `transactions` |
| GET | `/transactions?year=YYYY` | `view_transactions` |
| POST | `/receipts` | `scan_receipt` |
| POST | `/invites`, `/invites/accept` | `invites` |
| GET / PUT | `/accounts/{id}` | `accounts` |

All routes require the Cognito authorizer.

## Prerequisites

1. AWS account + bootstrapped CDK environment (`cdk bootstrap`).
2. Google OAuth client created in Google Cloud Console.
3. Secret stored in AWS Secrets Manager:

   ```bash
   aws secretsmanager create-secret \
     --name prudent/google-oauth \
     --secret-string '{"client_id":"...","client_secret":"..."}'
   ```

4. (Production only) ACM certificate in `us-east-1` for `prudigo.com`, passed via context: `--context frontendCertArn=arn:aws:acm:...`.
5. (Optional) Override CORS origins: `--context allowedOrigins="https://example.com,http://localhost:5173"`.

## Commands

```bash
pip install -r requirements.txt
cdk synth
cdk deploy PrudentBackendStack
cdk deploy PrudentFrontendStack   # after `npm run build` in ../app
pytest                            # run the handler test suite
```

## Testing

Each Lambda has a focused pytest module under [tests/](tests/) using the helpers in [tests/helpers.py](tests/helpers.py) which stub S3 and Cognito events. No live AWS calls are required.
