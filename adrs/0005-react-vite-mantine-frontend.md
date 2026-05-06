# ADR 0005: React + Vite + Mantine for the SPA

- **Status:** Accepted
- **Date:** 2026-01

## Context

The frontend needs a productive way to build forms-heavy screens (transaction entry, library management, budgets), good mobile responsiveness, and a small build that is cheap to host on CloudFront. We do not need server-side rendering or SEO — the app is private after sign-in.

## Decision

- **Framework:** React 18 (function components + hooks).
- **Build tool:** Vite. Fast dev server, ES module output, simple production bundle.
- **UI library:** Mantine v7 — comprehensive component set, accessible by default, built-in form helpers, hooks library.
- **Routing:** React Router v6 (BrowserRouter with CloudFront SPA fallback).
- **Auth client:** AWS Amplify (Auth module only) for the Cognito Hosted UI flow and token retrieval.
- **HTTP:** native `fetch`, wrapped by `lib/api.js` to inject the Cognito ID token.

## Consequences

**Positive**
- Fast iteration: Vite HMR is sub-second.
- Mantine eliminates most bespoke UI plumbing.
- Single JS bundle deployed as static assets; no SSR runtime.
- Amplify Auth is a thin, well-tested wrapper around Cognito Hosted UI.

**Negative**
- Amplify's full SDK is large; we import only `aws-amplify` Auth surface to keep the bundle reasonable.
- No SSR means initial load shows a brief loading state until auth resolves.
- Mantine v7 is opinionated about CSS layers — clashes with custom styling require care.

## Alternatives Considered

- **Next.js** — excellent, but SSR/edge features are unnecessary for an authenticated-only app and would complicate static hosting.
- **MUI / Chakra** — comparable; Mantine's hooks library and form helpers tipped the scale.
