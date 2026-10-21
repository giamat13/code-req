# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

AppRequest is a free, open-source static site where people request apps from developers without an account. `PROMPT.md` is the full build spec: phases in §14, data model in §7, security model in §8. `docs/decisions/` holds the ADRs.

The repo is early in Phase 0. Present: repo and tooling config, CI workflows, ADRs, and four domain modules in `public/js/domain/`. Not present yet: any HTML page, `public/css/`, `public/js/firebase-sdk.js`, `public/js/core/`, `public/js/services/`, `public/js/pages/`, `public/locales/`, `test/`, `scripts/seed-emulator.mjs`, `scripts/reset-emulator.mjs`, `playwright.config.*`, and most of `docs/`. README, CONTRIBUTING, and PROMPT.md name these files, so check that a file exists before you import it or document it.

## Changelog

Every change that alters behavior, data, rules, or the public site updates `CHANGELOG.md` in the same commit, under `## [Unreleased]`. Use the Keep a Changelog sections: Added, Changed, Deprecated, Removed, Fixed, Security. A change to Firestore rules also says in its entry that the rules must be deployed.

## Decisions that override PROMPT.md

Where an ADR differs from `PROMPT.md`, the ADR wins:

- Routes are query strings: `developer.html?u=<username>` and `track.html?r=<requestId>`, not `/d/` and `/r/` (ADR 0007). `firebase.json` has no rewrites.
- The embed button opens the developer page in a new tab, not in an iframe (ADR 0010).
- Nothing may frame the site. `X-Frame-Options: DENY` and `frame-ancestors 'none'` apply to every page (ADR 0009).
- Requests have a `lastMessageAt` field (ADR 0008). The PROMPT §7 table does not list it.

## Commands

Use Node 22 (`.nvmrc`); `package.json` requires 22.22.2 or later. Java 11 or later runs the emulators, but `firebase-tools` now refuses anything older than Java 21, so `npm run test:rules` needs Java 21 on `PATH`. CI uses Java 21. On this machine, Temurin 21 is installed at `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`. Dependencies are pinned exactly, with no `^` or `~`.

| Command                | Last checked                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`               | Not run this session                                                                                                               |
| `npm run emulators`    | Not run. Auth 9099, Firestore 8080, Hosting 5000, UI 4000, project `demo-apprequest`. Long-running, so start it in the background. |
| `npm run lint`         | Passes, but it covers almost nothing under `public/` yet                                                                           |
| `npm run format:check` | Passes                                                                                                                             |
| `npm run i18n:check`   | **Fails:** `public/locales/en.json` does not exist                                                                                 |
| `npm run test:unit`    | Exits 0 with **0 tests**. `test/` does not exist, and Node accepts an empty glob silently.                                         |
| `npm run test:rules`   | Not run. Needs Java and `test/rules/`.                                                                                             |
| `npm run test:e2e`     | Not run. Needs the emulators running and a `playwright.config.*`, which does not exist yet.                                        |
| `npm run check`        | Lint, format, i18n, unit. Fails at i18n today.                                                                                     |

Run a single test file:

- Unit: `node --test test/unit/<name>.test.mjs`. Add `--test-name-pattern="<text>"` to run one case.
- Rules: keep the wrapper from `npm run test:rules` and replace the glob with the file, for example `firebase emulators:exec --only firestore --project demo-apprequest "node --test test/rules/<name>.test.mjs"`.

Other scripts:

- `npm run config` writes `public/js/firebase-config.js` from `FIREBASE_*` variables. Without them it keeps the placeholders.
- `npm run vendor` copies DOMPurify and Inter from `node_modules` into `public/`. Run it after a version change and commit the result.
- `npm run seed` and `npm run reset` call scripts that are not written yet.

## Architecture

**No build step, one deploy folder.** Runtime code is plain HTML, CSS, and native ES modules in `public/`, served as-is (ADR 0001). Firebase Hosting (`"public": "public"` in `firebase.json`) and GitHub Pages (`pages.yml` uploads `public/`) both deploy that folder. Node is for tooling only.

**Two hosts, two places for headers.** Firebase sends the security headers from `firebase.json`. GitHub Pages cannot send headers, so every HTML page also carries a `<meta http-equiv="Content-Security-Policy">` with the same policy (ADR 0009). Change the CSP in both places. A meta tag cannot enforce `frame-ancestors`, so framing protection exists only on Firebase.

**Firebase is reached through one file.** Browser code loads the Firebase SDK 10.14.1 from gstatic, and only `public/js/firebase-sdk.js` imports it (ADR 0006). Do not import the `firebase` npm package in `public/`. The npm `firebase` 11.10.0 is a dev dependency for the rules tests only (ADR 0013).

**Config is generated, and one script edits sources.** `scripts/write-config.mjs` writes `public/js/firebase-config.js` from `FIREBASE_*` variables. The committed file holds `REPLACE_WITH_*` placeholders (ADR 0011). When `SITE_URL` is set, the same script replaces `__SITE_URL__` in place in every `.html`, `.xml`, `.txt`, and `.webmanifest` under `public/`. Keep that placeholder in the committed sources, and revert those edits before you commit after a local run that set `SITE_URL`.

**The domain layer is pure.** `public/js/domain/` (constants, validation, usernames, time) imports no DOM or Firebase code, so `node:test` can test it directly. Validators return `ok` plus `{ key, params }` errors, and the UI translates the key.

**Vocabulary exists in several places on purpose.** Platforms, statuses, templates, budgets, and length limits live in `domain/constants.js` and must match `firestore.rules`. The reserved username list lives in `domain/usernames.js` and in `firestore.rules`, and both must change together (ADR 0004). ADR 0004 says rules tests check this; none exist yet.

**Firestore rules are the security boundary.** `firestore.rules` denies by default and never trusts the client. Write rules check the exact key set (`keys().hasOnly`), the key count (`isNewRequest` expects 20 keys), enum values, and `request.time` for timestamps. A new field needs changes to the rules, to the data model, and to a rules test. Request IDs are bearer tokens (ADR 0003): anyone with the ID can read, message, and cancel a `new` request. Only the owning developer can list requests, so do not add a query that lists requests across users.

**User SVG is sanitized in the browser.** The client sanitizes with DOMPurify, stores the result as text, and renders it only as `<img src="data:image/svg+xml...">`. The rules check only that the string looks like an `<svg>` element. They cannot sanitize it (ADR 0005).

**DOM and strings.**

- No inline scripts and no inline event handlers. The CSP blocks both.
- ESLint rejects `innerHTML`, `outerHTML`, and `insertAdjacentHTML` in `public/`. Build nodes with `h()` and `svg()` from `public/js/core/dom.js`, which is planned and not written yet.
- Every user-visible string goes through `t(key, params)`. `scripts/check-i18n.mjs` checks that `en.json` and `he.json` have the same keys and placeholders, and that every `t("...")` and `data-i18n` key exists in `en.json`. Add the key to `en.json` before you use it.
- Hebrew is right-to-left, so use logical CSS properties such as `margin-inline-start`, not `margin-left`.

**Vendored files.** `public/vendor/dompurify/` and `public/assets/fonts/` are copies from `node_modules`. Change them only through `npm run vendor`. ESLint ignores `public/vendor/**`.

**CI and deploy.**

- `ci.yml` runs on pull requests and on pushes to `main` and `build/**`. It runs lint, format, i18n, and unit tests. Then it runs the rules and E2E tests against the emulators on Java 21. A gitleaks job runs alongside.
- `pages.yml` runs on pushes to `main`. It generates the config and deploys `public/` to GitHub Pages.
- `deploy.yml` runs only by hand. It deploys rules, indexes, and Hosting to Firebase with a service-account secret.

**Known blockers, checked 2026-10-21. Report them once and do not dig into them again.**

- `deploy.yml` fails with `Failed to authenticate`. The `firebase` environment has no `FIREBASE_SERVICE_ACCOUNT` secret and no `FIREBASE_PROJECT_ID` variable. This machine has no Firebase login either. The owner decides how to supply credentials.
- `test:e2e:ci` fails in CI because `playwright.config.*` does not exist yet. It is not caused by a change in the code.
- Rules tests pass locally and in CI (85 of 85 on 2026-10-21). If a deploy is blocked, say so and move on. Do not keep retrying the same failure.

Workflow rules, such as Conventional Commits, branch names, the PR checklist, and when an ADR is required, are in `CONTRIBUTING.md`.
