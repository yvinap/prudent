# ADR 0001: Serverless AWS Stack

- **Status:** Accepted
- **Date:** 2026-01

## Context

Prudent is a personal/family expense tracker with low and bursty traffic — a single user/family will issue at most a handful of requests per day. Running an always-on web server (ECS, EC2, RDS) would cost more than the actual usage warrants and require ongoing patching.

We need:
- HTTPS API with authentication
- Per-user data isolation
- Static SPA hosting
- Cheap idle cost
- Reproducible deployment

## Decision

Build the entire backend on AWS serverless primitives, provisioned via AWS CDK (Python):

- **API Gateway (REST)** as the public entry point.
- **AWS Lambda** for every handler (Python 3.12).
- **Amazon Cognito** for authentication.
- **Amazon S3** for both data (see ADR-0002) and static SPA hosting (see ADR-0006).
- **AWS CDK** for infrastructure as code, one app with split stacks (`Backend`, `Frontend`).

## Consequences

**Positive**
- Idle cost is effectively zero; pay-per-request scales naturally with the user base.
- No servers, OS patches or capacity planning.
- IAM gives us tight per-Lambda S3 permissions.
- CDK gives type-safe, reviewable infra changes.

**Negative**
- Cold starts on Python Lambdas add latency to rare-path requests.
- 29 s API Gateway / Lambda timeout caps long-running operations.
- Local development requires mocking AWS services (we use pytest with stubs).
- Vendor lock-in on AWS-specific services (Cognito, API Gateway).
