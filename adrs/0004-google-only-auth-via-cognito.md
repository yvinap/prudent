# ADR 0004: Google-only Authentication via Cognito

- **Status:** Accepted
- **Date:** 2026-01

## Context

Prudent needs authenticated access. Building password-based auth requires email verification, password reset, MFA, breach monitoring, and rate limiting — all undifferentiated work for a personal-finance side project. Most target users already have Google accounts.

We also want a managed JWT issuer that integrates with API Gateway out of the box.

## Decision

- **Identity broker:** Amazon Cognito User Pool with **self-signup disabled**.
- **Identity provider:** Google federation only, requesting `openid email profile` scopes.
- **Frontend integration:** AWS Amplify Auth using the Cognito Hosted UI for the OAuth authorization-code flow.
- **API authorization:** API Gateway `CognitoUserPoolsAuthorizer` validates the ID token on every request; Lambdas read `sub`/`email` from the request context claims.
- **First-login provisioning:** A `PostAuthentication` Lambda trigger (`register_user`) creates the user record, their personal account, and seeds default categories on the first sign-in.
- **OAuth secret:** Stored in AWS Secrets Manager under `prudent/google-oauth`; resolved at deploy time via CDK dynamic references and never committed to source.

## Consequences

**Positive**
- No password storage, reset, or MFA code to write.
- Single-tap sign-in for the vast majority of target users.
- API Gateway natively validates Cognito tokens — Lambdas do not handle auth.
- Adding more IdPs (Apple, Microsoft) later is configuration only.

**Negative**
- Hard dependency on Google as an identity provider; users without a Google account cannot sign up.
- Cognito Hosted UI styling is limited compared to a custom auth screen.
- Vendor lock-in on Cognito for token issuance.
