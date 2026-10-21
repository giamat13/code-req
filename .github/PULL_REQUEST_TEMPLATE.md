## What changed

<!-- One or two sentences. Link the issue with "Closes #123" when there is one. -->

## Checklist

- [ ] `npm run lint`, `npm run format:check`, and `npm run test:unit` pass.
- [ ] If `firestore.rules` changed: rules tests were added or updated, and `npm run test:rules` passes.
- [ ] Every new user-visible string is in `public/locales/en.json` and `public/locales/he.json` (`npm run i18n:check`).
- [ ] No `innerHTML` with user data, no inline scripts, and no inline event handlers.
- [ ] Keyboard and screen-reader behavior checked for any new UI.
- [ ] `CHANGELOG.md` has an entry under `Unreleased` for user-visible changes.
- [ ] Decisions that change the architecture have an ADR in `docs/decisions/`.
