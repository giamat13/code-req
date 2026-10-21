# 0013: Test tooling versions

- Status: Accepted
- Date: 2026-10-21

## Context

The project targets Node 22 (`.nvmrc`, `engines`). The newest `@firebase/rules-unit-testing` (6.x) requires Node 24.12 and the Firebase 13 client. The application keeps Firebase 10.14.1 from gstatic.

## Decision

- `@firebase/rules-unit-testing` is pinned to 4.0.1, which needs the Firebase 11 client. Firebase 11 is a dev dependency used only by the rules tests. The browser keeps 10.14.1.
- `firebase-tools` is pinned to 15.34.0, which supports Node 20, 22, and 24.
- `jsdom` is pinned to 30.1.3, which requires Node 22.22.2 or later. `engines` in `package.json` says the same.
- All other dev dependencies are exact versions, without `^` or `~`.

## Consequences

- When Node 22 is retired, move the rules tests to the newer testing package and its Firebase client together.
- Upgrades go through a pull request that runs the full check list.
