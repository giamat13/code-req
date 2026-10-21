# 0001: No build step for the app

- Status: Accepted
- Date: 2026-10-21

## Context

code-req should be easy to read, fork, and self-host. Static hosts such as GitHub Pages and Firebase Hosting serve files as they are. Contributors should not need a bundler to change a line of UI.

## Decision

Runtime code is plain HTML, CSS, and native ES modules served from `public/`. Node.js is used only for developer tooling: linting, tests, the emulators, and small scripts that write configuration or copy vendored files.

## Consequences

- No JSX, TypeScript, or bundler. Modules stay small and import each other by relative path.
- Browsers load the Firebase SDK from gstatic. The version is pinned in one file (`public/js/firebase-sdk.js`).
- Pages load their own modules, so each page downloads only what it uses.
