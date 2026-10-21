# 0006: Vendor browser dependencies

- Status: Accepted
- Date: 2026-10-21

## Context

The site should not depend on a third-party CDN for code that runs in the sanitizer or on every page. Subresource integrity is not available for ES module imports, and a compromised CDN file would run with full access to the page.

## Decision

- DOMPurify 3.1.6 is copied into `public/vendor/dompurify/`, with its license. `scripts/vendor.mjs` copies it from `node_modules`.
- The Inter variable font is copied into `public/assets/fonts/` under the SIL Open Font License.
- The Firebase SDK is the one exception. It loads from `https://www.gstatic.com/firebasejs/10.14.1/`, and only `public/js/firebase-sdk.js` imports it.

## Consequences

- Upgrading DOMPurify or Inter means running `npm run vendor` and committing the copied files.
- `npm run vendor` requires the dev dependencies to be installed first.
