# 0002: Run on the Firebase Spark (free) plan

- Status: Accepted
- Date: 2026-10-21

## Context

Anyone should be able to self-host code-req without adding a billing account. Cloud Functions and new Cloud Storage buckets require the Blaze (pay-as-you-go) plan.

## Decision

The core product uses Firebase Authentication (Google), Cloud Firestore, and Hosting only. Cloud Functions are not part of the core. Anything that needs Blaze is optional and documented as such.

## Consequences

- Rate limiting is not enforced on the server. The client applies a cooldown and a honeypot field. App Check is recommended and documented in `docs/security-model.md`.
- Email notifications are deferred to a later release (see `ROADMAP.md`).
- SVG icons are stored as text in Firestore, not in Storage (see ADR 0005).
