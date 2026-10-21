# 0011: Firebase configuration comes from environment variables

- Status: Accepted
- Date: 2026-10-21

## Context

Each deployment needs its own Firebase project, and the repository should not hold one maintainer's project settings. The configuration is public, but it still belongs to the deployment, not the code.

## Decision

`scripts/write-config.mjs` writes `public/js/firebase-config.js` from `FIREBASE_*` environment variables. Without them, the file keeps `REPLACE_WITH_*` placeholders, and the app shows a "not configured" notice instead of failing. The same script fills the `__SITE_URL__` placeholder in the sitemap, robots file, and Open Graph tags.

Continuous integration sets the variables from GitHub repository variables. Local development uses the emulators on `localhost`, which skip the real configuration.

## Consequences

- `npm run config` regenerates the file. Run it after changing a variable.
- The committed file contains placeholders only.
- The web config values are public, but they are kept in repository variables so forks and deployments stay separate.
