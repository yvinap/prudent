# ADR 0002: S3 as the Primary Datastore

- **Status:** Accepted
- **Date:** 2026-01

## Context

Prudent must persist users, accounts, transactions, receipts, and reference data (things, tags, categories, budgets). Traditional choices would be DynamoDB or RDS. Both impose either provisioned cost (RDS) or per-request request-unit cost and a more rigid data model (DynamoDB).

The product has very low write volume per user, no strong relational requirements, and benefits from cheap, durable, hierarchical storage that can also host receipt images.

## Decision

Use a **single S3 bucket** (`prudent-{account}-{region}`) as the system of record for all application data. No relational database, no DynamoDB.

Folder layout, schemas, and access patterns are documented in [DataModel/DataModel.md](../DataModel/DataModel.md).

Lambdas read/write JSON documents using the AWS SDK; eventual consistency is acceptable because each user's writes are serialized through a small set of Lambdas.

## Consequences

**Positive**
- Single storage primitive for both structured data and binary receipts.
- 99.999999999% durability and trivial backup story (versioning + lifecycle rules).
- Per-request cost dominates only when the user is actually using the app.
- Zero infrastructure to maintain compared to RDS/DynamoDB.

**Negative**
- No transactions across keys — concurrent writers to the same JSON document can race. Mitigated by low write volume and (future) S3 conditional writes / object lock.
- No server-side query capability; all filtering happens in Lambda after a GET.
- Aggregations across users (e.g. analytics) would require a secondary scan/export pipeline.

## Alternatives Considered

- **DynamoDB** — flexible, but per-item billing and access patterns favored a single aggregated document; reference data per account fits naturally as one JSON file.
- **RDS / Aurora Serverless** — overkill for the workload; cold-start and minimum capacity costs dominate.
