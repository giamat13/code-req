# 0012: Deploy to GitHub Pages from a Pages artifact

- Status: Accepted
- Date: 2026-10-21

## Context

The owner asked for the site to work on GitHub Pages in addition to Firebase Hosting. GitHub Pages can serve the static files directly, so the deployment is a copy of `public/`.

## Decision

`.github/workflows/pages.yml` runs on pushes to `main`. It reads the Pages base URL, writes the Firebase configuration and site URL (ADR 0011), uploads `public/` as a Pages artifact, and deploys it. The `public/.nojekyll` file stops GitHub from running Jekyll on the files.

Before the first deployment, the owner must do two things:

1. In **Settings → Pages**, set the source to **GitHub Actions**.
2. In the Firebase console, add `<owner>.github.io` to **Authentication → Settings → Authorized domains**. Google sign-in fails from the GitHub Pages origin without it.

## Consequences

- The site works under the `/apprequest/` subpath because every link is relative (ADR 0007).
- GitHub Pages cannot set headers, so the policy is enforced by the meta tag only, and framing protection is missing there (ADR 0009).
- Firestore security is unaffected, because all access control runs in Firestore rules.
