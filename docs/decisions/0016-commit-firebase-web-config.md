# 0016: The Firebase web configuration is committed

- Status: Accepted
- Date: 2026-10-21

## Context

The Firebase web configuration identifies the project. It is not a secret: the security of the data comes from the Firestore and Auth rules, not from these values (ADR 0013 covers the rules tests). Keeping the values only in GitHub repository variables made the deployed site depend on settings outside the repository, and a deploy without them showed a "not configured" notice.

## Decision

`public/js/firebase-config.js` is committed with the project's values. The Pages and deploy workflows run `scripts/write-config.mjs --site-only`, which fills only the `__SITE_URL__` placeholder and leaves the config file alone. `npm run config` still regenerates the file from `FIREBASE_*` variables, for a deployment that uses another project.

## Consequences

- A fork that deploys to its own Firebase project replaces the values in `public/js/firebase-config.js`, or runs `npm run config` with its own `FIREBASE_*` variables.
- The `FIREBASE_*` repository variables are no longer read by the workflows and can be deleted.
- ADR 0011 is partly superseded. The Firebase values now come from the committed file. Its `__SITE_URL__` decision still applies.
