# Roadmap

## Version 0.1.0

The first release covers the core product: requesting, developer onboarding, the dashboard board, quotes and
messages, portfolios, moderation, and deployment to Firebase Hosting and GitHub Pages.

## Next

- Email notifications for status changes through optional Cloud Functions. This needs the Blaze plan and stays off
  by default (ADR 0002).
- A QR code for the developer link.
- Pretty developer URLs on hosts that can rewrite paths (ADR 0007).
- A step-by-step App Check guide with reCAPTCHA Enterprise.
- More locales. See `docs/i18n.md`.

## Good first issues

- Add a locale: copy `public/locales/en.json`, translate it, and run `npm run i18n:check`.
- Improve an empty-state illustration in `public/css/components.css` and the matching markup.
- Add rules tests for an edge case you find in `firestore.rules`.
- Write a keyboard walkthrough for one dashboard view and file the gaps as issues.
- Extend `test/unit/` with cases for the CSV export.
