# Contributing

Thanks for helping. This project is small on purpose, so most changes are easy to review. Please read this page before opening a pull request.

## Set up

1. Install Node.js 22.22.2 or later, and Java 11 or later.
2. Run `npm ci`.
3. Run `npx playwright install chromium` if you want the end-to-end tests.
4. Run `npm run emulators` and open http://localhost:5000.

To load sample data, run `npm run seed` while the emulators are running. `npm run reset` clears it.

## Commands

| Command                                   | What it does                                                        |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `npm run emulators`                       | Starts Auth, Firestore, and Hosting emulators                       |
| `npm run seed` / `npm run reset`          | Adds or removes demo data in the emulators                          |
| `npm run lint`                            | ESLint, including the rule that forbids `innerHTML`                 |
| `npm run format` / `npm run format:check` | Prettier                                                            |
| `npm run i18n:check`                      | Verifies that every locale has the same keys and placeholders       |
| `npm run test:unit`                       | Unit tests (`node:test`)                                            |
| `npm run test:rules`                      | Firestore rules tests against the emulator                          |
| `npm run test:e2e`                        | End-to-end tests (needs the emulators running)                      |
| `npm run config`                          | Regenerates `public/js/firebase-config.js` from `FIREBASE_*` vars   |
| `npm run vendor`                          | Copies DOMPurify and the font into `public/` after a version change |

Run `npm run check` before you push. It covers lint, format, translations, and unit tests.

## Commit messages and branches

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
- Keep one logical change in each commit.
- Name branches `feat/<topic>`, `fix/<topic>`, or `docs/<topic>`.

## Pull requests

- Fill in the pull request template, including the checklist.
- A change to `firestore.rules` needs a rules test that fails before the change and passes after it.
- A new user-visible string needs a key in `public/locales/en.json` and a translation in each other locale.
- A change to the architecture needs an ADR in `docs/decisions/`.

## Adding a language

Copy `public/locales/en.json` to `public/locales/<code>.json`, translate every value, and keep every placeholder such as `{count}`. Then run `npm run i18n:check`. See [docs/i18n.md](docs/i18n.md) for details. Right-to-left languages also need an entry in `RTL_LOCALES` in `public/js/core/i18n.js`.

## Adding a platform

Platforms are listed in three places. Change all three in the same pull request:

1. `public/js/domain/constants.js` (the `PLATFORMS` list).
2. `firestore.rules` (the `isPlatforms` function).
3. The `platform.*` keys in every locale file.

Add a unit test for the new value and a rules test that accepts it.

## Coding rules

- Build DOM with `h()` or `svg()` from `public/js/core/dom.js`. Do not use `innerHTML`.
- Use relative links and asset paths. The site also runs under a subpath on GitHub Pages.
- Use logical CSS properties (`margin-inline-start`, not `margin-left`) so the layout works in right-to-left languages.
- No inline scripts or inline event handlers. The Content Security Policy blocks them.
- Keep the runtime free of build steps (ADR 0001).

## Reporting bugs and security problems

Bugs go in the issue tracker, using the bug report template. Security problems follow [SECURITY.md](SECURITY.md) and are not reported in public issues.

## Code of conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
