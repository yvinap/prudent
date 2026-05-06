# ADR 0003: Aggregated JSON Storage Layout

- **Status:** Accepted
- **Date:** 2026-01
- **Relates to:** [ADR-0002](0002-s3-as-primary-datastore.md)

## Context

Given S3 as the datastore (ADR-0002), the next question is granularity. Two extremes exist:

1. **One file per record** (e.g. `things/{thingId}.json`). Simple writes, but listing/loading require many GETs and `LIST` operations, which are expensive and latency-prone.
2. **One aggregated document per logical group.** Loading a year of transactions or all categories costs exactly **1 GET**.

For a personal-finance app, reads dominate writes, and write volume per user is low (a handful of transactions per day at most). Concurrent writes to the same document are rare.

## Decision

Store reference and time-bounded data as **aggregated JSON documents**:

| Entity | File | Shape |
|--------|------|-------|
| Things | `Metadata/accounts/{accountId}/things.json` | array |
| Tags | `Metadata/accounts/{accountId}/tags.json` | array |
| Categories | `Metadata/accounts/{accountId}/categories.json` | array |
| Budgets | `Metadata/accounts/{accountId}/budgets.json` | array |
| Transactions | `Transactions/{accountId}/{year}.json` | `{ "MM": { "DD": [tx, ...] } }` |
| Audit logs | `AuditLogs/{userId}/{year}/{month}/{date}.json` | array |

User and account records remain one-file-per-entity because they have stable, well-known IDs.

All Lambdas use a strict **GET → modify → PUT** pattern.

## Consequences

**Positive**
- Listing all things/categories/etc. for an account is a single GET.
- A full year of transactions loads in 1 GET regardless of count.
- API surface stays simple — no pagination required for typical usage.
- Costs are predictable and dominated by GETs (cheap).

**Negative**
- Lost-update risk if two writes hit the same document concurrently. Mitigated because (a) write volume per user is very low, (b) each account has at most a few users, (c) we can layer S3 conditional writes (`If-Match`) when needed.
- Per-write payload grows over time (the year file gets larger as the year fills). Acceptable for personal-scale data.
- Schema evolution requires migrating whole files, not individual rows.
