# Prudent — Frontend (`app/`)

Single-page React application served from CloudFront. Provides the user interface for sign-in, transaction entry, receipt scanning, library management, budgets, and account sharing.

## Tech Stack

- **React 18** with **Vite** for build/dev server
- **Mantine v7** UI components
- **React Router v6** for client-side routing
- **AWS Amplify (Auth)** for the Cognito Hosted UI / OAuth flow

## Project Layout

```
app/
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx           # React entry
│   ├── App.jsx            # Router + auth gates + invite acceptance
│   ├── config.js          # Amplify/Cognito + API base config
│   ├── components/
│   │   └── AppShell.jsx   # Shared chrome (header, nav)
│   ├── contexts/
│   │   └── AuthContext.jsx# user / loading / signOut
│   ├── lib/
│   │   ├── auth.js        # Amplify wrappers
│   │   └── api.js         # fetch wrapper that attaches the JWT
│   └── screens/
│       ├── WelcomeScreen.jsx
│       ├── HomeScreen.jsx
│       ├── AddTransactionScreen.jsx
│       ├── QuickAddScreen.jsx
│       ├── ScanReceiptScreen.jsx
│       ├── UploadReceiptScreen.jsx
│       ├── ViewTransactionsScreen.jsx
│       ├── BudgetScreen.jsx
│       ├── ManageLibraryScreen.jsx
│       └── AccountScreen.jsx
```

## High-Level Flow

```
   ┌──────────────┐   not signed in   ┌──────────────────┐
   │   /  (App)   │──────────────────▶│  WelcomeScreen   │
   │ AuthProvider │                   │  → Hosted UI     │
   └──────┬───────┘                   └────────┬─────────┘
          │ signed in                          │ OAuth redirect
          ▼                                    ▼
   ┌──────────────┐                  ┌────────────────────┐
   │ InviteAccept │  ?invite=TOKEN   │   Cognito returns  │
   │  (auto run)  │◀─────────────────│   tokens via       │
   └──────┬───────┘                  │   Amplify          │
          │                          └─────────┬──────────┘
          ▼                                    │
   ┌──────────────────────────────────────────┴───────┐
   │ AppShell + Routes                                │
   │   /home  /add  /quick  /scan  /upload            │
   │   /transactions  /budget  /library  /account     │
   └──────────────────────────────────────────────────┘
              │
              ▼  api.fetch(path) attaches `Authorization: Bearer <JWT>`
   ┌──────────────────────────┐
   │  API Gateway (prudent)   │
   └──────────────────────────┘
```

### Key flows

1. **Sign in.** `WelcomeScreen` triggers the Cognito Hosted UI via Amplify. After redirect, `AuthContext` loads the current session and exposes `user`.
2. **Invite link.** When the app loads with `?invite=TOKEN`, `InviteAcceptor` stores the token, waits for the user to be authenticated, then calls `api.acceptInvite` and routes to `/account`.
3. **API calls.** `lib/api.js` wraps `fetch`, fetching the current ID token from Amplify and adding the `Authorization` header. All screens go through this helper.
4. **Add transaction.** `AddTransactionScreen` (or `QuickAddScreen`) loads things/categories/tags from the library, validates the form, and `POST /transactions`.
5. **Scan receipt.** `ScanReceiptScreen` calls `POST /receipts` to get a presigned PUT URL, uploads the image directly to S3, then receives parsed line items and lets the user confirm/edit before saving as a transaction.
6. **View transactions.** `ViewTransactionsScreen` calls `GET /transactions?year=YYYY` and renders the month → day → records map returned by the backend.

## Configuration

Cognito User Pool ID, App Client ID, Hosted UI domain, and the API base URL are set in [src/config.js](src/config.js). For deploys these come from the CDK outputs of `PrudentBackendStack`.

Local development uses `app/.env.local`; copy [.env.example](.env.example) and fill in the values from your CDK stack outputs. `.env.production` is git-ignored.

## Scripts

```bash
npm install
npm run dev      # local dev server
npm run build    # produces dist/
npm run preview  # serve the production build locally
```

The CDK frontend stack deploys `dist/` to S3 and invalidates CloudFront — see [../infra/frontend_stack.py](../infra/frontend_stack.py).
