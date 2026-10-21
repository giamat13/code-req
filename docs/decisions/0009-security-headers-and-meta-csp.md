# 0009: Security headers on Firebase, Content Security Policy in every page

- Status: Accepted
- Date: 2026-10-21

## Context

Firebase Hosting can set response headers in `firebase.json`. GitHub Pages cannot. The policy must still apply on GitHub Pages.

## Decision

- `firebase.json` sets `Content-Security-Policy` (including `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security`.
- Every HTML page also contains a `<meta http-equiv="Content-Security-Policy">` tag with the same policy. Browsers enforce it on GitHub Pages too.
- Browsers ignore `frame-ancestors` and `X-Frame-Options` when they arrive in a `<meta>` tag, so framing protection exists only on Firebase Hosting.

## Consequences

- Scripts must be modules from `'self'` or the allowed Firebase origins. Inline scripts and inline event handlers are blocked.
- The policy allows `localhost` emulator origins so the emulators work. Production deployments carry the same policy. The extra origins are local-only, and this is documented in `docs/security-model.md`.
- Styles may be inline (`'unsafe-inline'` for `style-src` only), because the Firebase popup injects them.
