# AppRequest: Full Build Prompt

> Give this whole file to an AI coding agent or a developer. Build it in the phase order in section 14. Where this file is silent, choose the most polished, secure, and useful option for a free, open-source, self-hostable product, and record the choice as an ADR in `docs/decisions/`. Do not stop at an MVP. The features in section 13 are required.

---

## 0. Ground rules

- **Language:** all UI text (default locale), code, comments, docs, commit messages, and issue templates are in English. `public/locales/he.json` is a second, complete translation and must render right-to-left.
- **No build step for the app.** Runtime code is plain HTML, CSS, and native ES modules served as-is from `public/`. Node.js is only for developer tooling: lint, tests, emulators, and seeding.
- **Must run on the Firebase Spark (free) plan.** No Cloud Functions and no Cloud Storage in the core. Anything that needs Blaze is isolated, documented, and disabled by default.
- **Security first:** default-deny Firestore rules, no secrets in the repository, no inline scripts or inline event handlers, no `innerHTML` with user data.
- **Runs without a real Firebase project.** Everything works on the Firebase Emulator Suite, so a contributor can start with `npm run emulators`.
- **Accessibility:** WCAG 2.2 AA, mobile-first, every action reachable by keyboard.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), one logical change per commit.

---

## 1. Product

AppRequest is a free, open-source website where anyone can ask a developer to build an app. Developers get a public profile and a dashboard for the requests they receive.

### Actors
- **Requester:** anyone. No account needed.
- **Developer:** signs in with Google, claims a unique username, and gets a personal link (`/d/<username>`). Requesters use the link, or find the developer by username on the landing page.
- **Platform admin:** a maintainer who moderates reports and suspends abusive developers. Created by hand in Firestore.

### Core loop
1. A requester opens a developer link, or types a username on the landing page.
2. The requester submits the request form and receives a **tracking link** (`/r/<requestId>`). The page insists they save it, because it is the only way back.
3. The developer sees the request on their dashboard, sends a quote, talks through details in a thread, and moves the request through its statuses.
4. The requester follows progress on the tracking page, reads quotes and replies, and can cancel while the request is still new.
5. When the work ships, the developer adds it to their public portfolio.

### Glossary

| Term | Meaning |
|---|---|
| Username | Unique lowercase handle, 3–30 characters. It is also the developer's "code". |
| Developer link | `/d/<username>`: the public page that contains the request form. |
| Tracking link | `/r/<requestId>`: the requester's status page. |
| Request ID | Firestore auto-ID (20 random characters). Knowing the ID grants access to that request. |
| Portfolio entry | A public, curated copy of a finished request's non-private fields. |
| Quote | Price and timeline offered by the developer. Visible to the requester. |

---

## 2. Technology (pinned)

- HTML5, CSS custom properties, CSS Grid and Flexbox, native ES modules, native `<dialog>`, native `<details>`. **No framework.**
- **Firebase JS SDK 10.14.1 (modular)** from `https://www.gstatic.com/firebasejs/10.14.1/`. Import it only through `public/js/firebase-sdk.js`, which re-exports what the app needs. Upgrading the SDK means editing one file.
- **DOMPurify 3.1.6**, vendored into `public/vendor/dompurify/` with its license. Do not load it from a CDN.
- **Inter** font, self-hosted in `public/assets/fonts/` (woff2, OFL license).
- Dev tooling, Node 22 LTS or newer: ESLint 9 (flat config), Prettier, `firebase-tools`, `@firebase/rules-unit-testing`, `node:test` with `jsdom`, Playwright with `@axe-core/playwright`.

Pin exact versions in `package.json`. Do not use `^` or `~`.

---

## 3. Repository layout

```
apprequest/
├─ public/                          # served by Firebase Hosting, no build step
│  ├─ index.html                    # landing: find a developer, directory, FAQ
│  ├─ developer.html                # /d/<username>: profile, portfolio, request form
│  ├─ track.html                    # /r/<requestId>: status, quote, thread, cancel
│  ├─ dashboard.html                # developer: sign-in, onboarding, board, portfolio, settings
│  ├─ moderation.html               # platform admins only
│  ├─ privacy.html
│  ├─ 404.html
│  ├─ embed.js                      # optional "Request an app" button widget
│  ├─ sw.js                         # service worker: app shell only, never Firestore data
│  ├─ manifest.webmanifest
│  ├─ robots.txt
│  ├─ sitemap.xml
│  ├─ .well-known/security.txt
│  ├─ assets/                       # icons, illustrations, og-image.png, fonts/
│  ├─ css/
│  │  ├─ tokens.css                 # design tokens, light and dark
│  │  ├─ base.css                   # reset, typography, layout
│  │  ├─ components.css             # buttons, inputs, chips, badges, toasts, dialogs
│  │  └─ pages/                     # one stylesheet per page
│  ├─ js/
│  │  ├─ firebase-sdk.js            # the only file that imports from gstatic
│  │  ├─ firebase-config.js         # placeholder config and emulator detection
│  │  ├─ core/                      # i18n, theme, toast, dom, format, storage
│  │  ├─ domain/                    # validation, svg, usernames, platforms, csv, markdown
│  │  ├─ services/                  # auth, developers, requests, messages, portfolio, reports
│  │  └─ pages/                     # landing.js, developer.js, track.js, dashboard.js, moderation.js
│  ├─ vendor/dompurify/
│  └─ locales/en.json, he.json
├─ firestore.rules
├─ firestore.indexes.json
├─ firebase.json
├─ .firebaserc.example
├─ scripts/                         # seed-emulator.mjs, reset-emulator.mjs
├─ test/
│  ├─ rules/                        # rules tests against the emulator
│  ├─ unit/                         # node:test
│  └─ e2e/                          # Playwright
├─ .devcontainer/devcontainer.json
├─ .github/
│  ├─ workflows/ci.yml, deploy.yml, codeql.yml
│  ├─ ISSUE_TEMPLATE/               # bug_report.yml, feature_request.yml, translation.yml, config.yml
│  ├─ PULL_REQUEST_TEMPLATE.md
│  ├─ CODEOWNERS
│  └─ dependabot.yml
├─ docs/
│  ├─ architecture.md               # includes a Mermaid diagram
│  ├─ data-model.md, security-model.md, self-hosting.md
│  ├─ i18n.md, embedding.md, testing.md, release.md
│  └─ decisions/                    # ADRs: 0001-no-build-step.md, ...
├─ README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, SUPPORT.md
├─ CHANGELOG.md, ROADMAP.md, LICENSE
└─ package.json, eslint.config.mjs, .prettierrc, .editorconfig, .gitattributes, .nvmrc, .gitignore
```

---

## 4. Routes

| Path | File | How |
|---|---|---|
| `/` | `index.html` | static |
| `/d/<username>` | `developer.html` | rewrite `/d/**` |
| `/r/<requestId>` | `track.html` | rewrite `/r/**` |
| `/dashboard` | `dashboard.html` | `cleanUrls` |
| `/moderation` | `moderation.html` | `cleanUrls` |
| `/privacy` | `privacy.html` | `cleanUrls` |
| anything else | `404.html` | Hosting default |

Read the username or request ID from `location.pathname`. Normalize usernames to lowercase.

---

## 5. Design

### Visual direction
Calm, modern, and confident, like a well-made developer tool. Generous whitespace, one accent color, subtle depth, crisp type. It must not look like a default Bootstrap template. Every data view needs designed loading, empty, and error states.

### Tokens (`css/tokens.css`)
Define every value as a custom property on `:root`. Dark values apply under `@media (prefers-color-scheme: dark)` and under `[data-theme="dark"]`. A manual toggle is saved to `localStorage` inside try/catch. Set `color-scheme` so native controls follow the theme.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#FAFAFA` | `#09090B` |
| `--surface` | `#FFFFFF` | `#18181B` |
| `--surface-2` | `#F4F4F5` | `#27272A` |
| `--border` | `#E4E4E7` | `#3F3F46` |
| `--text` | `#18181B` | `#FAFAFA` |
| `--text-muted` | `#71717A` | `#A1A1AA` |
| `--accent` | `#6366F1` | `#818CF8` |
| `--accent-hover` | `#4F46E5` | `#A5B4FC` |
| `--on-accent` | `#FFFFFF` | `#09090B` |
| `--success` | `#15803D` | `#4ADE80` |
| `--warning` | `#B45309` | `#FBBF24` |
| `--danger` | `#B91C1C` | `#F87171` |
| `--info` | `#0369A1` | `#38BDF8` |

Also define:
- Type scale: 12, 14, 16, 18, 24, 32, 44 px. Inter. Headings at weight 650.
- Spacing on a 4 px grid: 4, 8, 12, 16, 24, 32, 48, 64.
- Radii: 8 for controls, 12 for cards, 999 for chips.
- Two shadow levels.
- Motion: 150 ms and 200 ms, `ease-out`. Disabled under `prefers-reduced-motion`.
- Breakpoints: 480, 768, 1024 px. Maximum content width 1120 px.

### Layout
- Top bar: logo, primary navigation, language select, theme toggle, sign-in or avatar menu. Collapses to a menu button on small screens.
- Footer: license, GitHub, privacy, security policy.
- Dashboard: sidebar on desktop, bottom tab bar on phones.
- Use logical CSS properties (`margin-inline-start`, `padding-block`, `inset-inline-end`) throughout, so RTL works without overrides.

### Components
Each component has default, hover, focus-visible, active, disabled, loading, and error states where relevant.
- Buttons: primary, secondary, ghost, danger. Spinner while loading.
- Inputs and textareas: label above, helper text, error text, character counter.
- Selects, date input, and checkbox "pills" for multi-select platforms.
- Status badges: color **plus** icon **plus** text. Never color alone.
- Avatars, cards, stat cards, tabs, dropdown menu, accordion (`<details>`).
- Toasts: top end, `aria-live="polite"`, auto-dismiss after 4 s, paused on hover and focus.
- Dialogs: native `<dialog>`, focus trapped, Escape closes, focus returns to the trigger.
- Drawer: side panel on desktop, full screen on phones.
- Skeleton loaders with shimmer, disabled under reduced motion.
- Empty states: an inline SVG illustration and one clear action.
- Status stepper: New, In progress, Done.
- Kanban columns.

### Micro-interactions
Optimistic status changes with rollback and an error toast. A success toast after each save. Copy buttons show a check icon for 1.5 s. Buttons scale to 0.98 on press. The drawer slides in.

### Graphics
Inline SVG only, with no external image requests. One icon style: 1.5 px stroke on a 24 px grid. Provide `favicon.svg`, `apple-touch-icon.png`, `og-image.png` (1200×630), and manifest icons.

---

## 6. Pages

### 6.1 Landing (`index.html`)
- **Hero:** headline, one-sentence explanation, and a "Find a developer" form with one input. The input accepts a username or a pasted developer link. Normalize it: trim, lowercase, strip a leading `@`, and extract the username from a full URL. If no developer matches: "No developer named @x. Check the spelling or browse the directory below."
- **How it works:** three steps with icons.
- **Directory:** developers where `acceptingRequests == true` and `suspended == false`. Each card shows avatar, display name, `@username`, pricing note, and platform badges. Search by name, username, or platform. Sort by name or newest. 24 per page with "Load more". Skeleton cards while loading. Designed empty state.
- **For developers:** a call to action that leads to `/dashboard`.
- **FAQ accordion:** Is it free? Who sees my request? Can I cancel? Why keep the tracking link?

### 6.2 Developer page (`developer.html`)
- **Profile header:** avatar, display name, `@username`, bio, website (`rel="noopener noreferrer"`), pricing note, accepted platforms, open or closed badge.
- **Actions:** copy developer link (full URL), Web Share API when available, Report developer.
- **Portfolio grid:** entries from `developers/{uid}/portfolio`. Each shows the sanitized SVG thumbnail, title, app name, platforms, and project link if set.
- **Request form** (6.3). If `acceptingRequests` is false, show "Not accepting requests right now" and no form. If `suspended` is true, show "This developer is not available" and no form.
- **Not found:** a friendly "No developer @x" page with a link to the directory.

### 6.3 Request form

| Field | Required | Rules | Notes |
|---|---|---|---|
| Full name | yes | 2–100 characters | stored as `requesterName` |
| Email | no | valid address, up to 254 characters | helper text: "Only the developer sees this." Stored in `private/contact`. |
| Template | no | Landing page, Mobile app, Internal tool, Browser extension, Desktop app, Other | Fills an empty description with starter text. Never overwrites text the user wrote. |
| Title | yes | 2–120 characters | |
| App name | yes | 2–80 characters | |
| Description | yes | 10–2000 characters | counter; textarea grows with content |
| Platforms | yes | at least one, only from the developer's accepted list | chips with checkbox semantics |
| SVG icon | no | upload `.svg` or paste code; up to 100 KB; sanitized (section 9) | live preview; remove button |
| Notes | no | up to 2000 characters | |
| Budget | no | Not sure, Under 500, 500–2,000, 2,000–10,000, Over 10,000 | Currency is set in the quote. |
| Deadline | no | date, not in the past | |
| Website | hidden | honeypot; must stay empty | `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"` |
| Consent | yes | "The developer will see what I submit." Link to Privacy. | |

Behavior:
- Validate on blur and on submit. Show a plain message next to each field. On a failed submit, focus the first invalid field and announce the error count through `aria-live`.
- **Review step:** "Review request" opens a dialog that summarizes everything. "Submit" finalizes. "Edit" closes it.
- **Draft autosave:** save to `localStorage` with a versioned key, debounced 500 ms, inside try/catch. Restore on load with a "Restored your draft" note and a "Discard draft" button. Clear on success.
- **Cooldown:** after a successful submit, block new submissions from this browser for 60 seconds. Store the timestamp locally. Document in `docs/security-model.md` that real rate limiting needs App Check or Cloud Functions.
- **Submit:** generate the ID client-side with `doc(collection(db, "requests"))`. In one batch, create `requests/{id}` and, if an email was given, `requests/{id}/private/contact`.
- **Success panel:** the tracking link with a copy button, a "Download as .txt" button, the warning "Save this link. It is the only way to see your request's status.", and "Submit another request".
- **Errors:** network failure keeps the draft and shows "Couldn't send. Check your connection and try again." `permission-denied` shows "This developer isn't accepting requests right now." Never clear the form on error.

### 6.4 Tracking page (`track.html`)
- Load the request with `getDoc`. If missing: "This request doesn't exist or was removed."
- Live updates through `onSnapshot` on the request and its messages. Show a small "Live" indicator.
- **Header:** title, app name, submitted date.
- **Stepper:** New, In progress, Done. Declined and Cancelled are terminal. Show them as a badge, not as a stepper step.
- **Quote card:** amount, currency, timeline, valid until. Hidden when there is no quote.
- **Developer card:** avatar, name, `@username`, link to their page.
- **Request summary:** collapsible, shows what the requester submitted.
- **Thread:** messages in order with timestamps. Requester messages align right, developer messages align left. Screen readers get the author role. Composer: textarea up to 2000 characters. Ctrl+Enter or Cmd+Enter sends. Disabled when cancelled.
- **Cancel request:** shown only when status is `new`. The confirm dialog explains that the developer will see the cancellation. Sets `status` to `cancelled`.
- **Page title** reflects status: "In progress · App name · AppRequest".

### 6.5 Dashboard (`dashboard.html`)

**Signed out:** a centered card, "Sign in with Google to receive app requests." The button calls `signInWithPopup`. If the popup is blocked, fall back to `signInWithRedirect`.

**Signed in, no profile: onboarding**
- Username field, prefilled from a slug of the Google display name. Validate against `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$` and the reserved list (section 8). Check availability with a 300 ms debounce by reading `usernames/{name}`. Show "@name is available" or "Already taken".
- Display name (prefilled), accepted platforms (default: all), and an "Accepting requests" toggle (default on).
- **Claim sequence:** (1) create `usernames/{username}` with `{ uid, createdAt }`. (2) create `developers/{uid}`. If step 2 fails, delete the username document and show an error. Step 1 is what makes the username unique, because Firestore rejects a create on an existing document.
- **Success screen:** the developer link, a copy button, a "Share" button, and "Go to dashboard".

**Signed in, profile exists: app shell**
- Header: developer link card (copy, open public page, optional QR code), notifications, avatar menu (settings, sign out).
- Tabs: Overview, Requests, Portfolio, Settings.

**Overview**
- Stat cards: New, In progress, Done, Declined, This week.
- Bar chart of requests per day for the last 14 days, as inline SVG computed from loaded data.
- Five most recent requests, each opens the drawer.

**Requests**
- **Board (default):** four columns: New, In progress, Done, Declined. Each card shows app name, title, requester name, platform chips, budget, relative age ("2h ago"), tags, and an unread dot. Drag and drop between columns. Keyboard alternative: focus a card and press Alt+ArrowLeft or Alt+ArrowRight to move it. Each column header shows its count.
- **List view:** sortable table with date, app name, status, budget, and platforms. The choice is stored in the URL.
- **Filters:** search (debounced; matches requester name, title, app name, description, tags), status, platform, budget, template, tag, and date range (today, 7 days, 30 days, all). All filters live in the URL query string, so views can be bookmarked and the back button works.
- **Live data:** `onSnapshot` on `where("developerUid", "==", uid)`, ordered by `createdAt` descending, limit 200. A new request shows the toast "New request: <app name>", updates the document title to "(n) Dashboard · AppRequest", and triggers a browser notification if the user opted in.
- **Unread:** a request is unread when its `updatedAt`, or its latest message time, is newer than the "last seen" time stored locally for that request. Opening the drawer marks it seen.

**Request drawer**
- Header: title, status select, "Copy brief as Markdown", a menu with Export JSON, Add to portfolio (when done), and Delete.
- Requester: name, and email with copy and `mailto:` link when provided.
- Details: app name, description, platforms, template, budget, deadline, notes, SVG preview (rendered as an `<img>` with a data URI, section 9).
- **Quote editor:** amount, currency (USD, EUR, GBP, ILS, CAD, AUD, Other), timeline text, valid until. Saves to `request.quote` and appears on the tracking page.
- **Thread:** all messages, a reply box (author role `developer`). The developer can delete any message.
- **Private area,** labeled "Only you can see this": internal notes (plain text, up to 5000 characters) and tags (up to 5, lowercase, up to 24 characters each), stored in `private/notes`.
- **Delete request:** confirm dialog. Deletes messages in batches of 500, then `private/*`, then the request.

**Portfolio tab**
- List of entries with a remove button.
- "Add from done requests" opens a picker of the developer's done requests that are not yet in the portfolio. Creates `developers/{uid}/portfolio/{requestId}` with public fields only: title, app name, platforms, SVG icon, optional project URL (https), and `shippedAt`.

**Settings tab**
- Profile: display name, bio (up to 280), website (https only), pricing note (up to 120), avatar (Google photo or initials).
- Accepted platforms and the "Accepting requests" toggle.
- Notifications: opt-in button for browser notifications.
- Language and theme.
- Data: export everything as JSON (profile, requests, messages, notes, portfolio). Export requests as CSV.
- Danger zone: delete account. Requires typing the username and re-authenticating. Cascade order: portfolio, requests with their subcollections, username document, developer document, then `deleteUser`.
- Sign out.

**Keyboard shortcuts** (listed in a `?` dialog): `/` focuses search. `j` and `k` move the selection in the list. `Enter` opens. `Escape` closes the drawer. `?` opens help. `g` then `o` goes to Overview. `g` then `r` goes to Requests.

### 6.6 Moderation (`moderation.html`)
- Only users with a `platformAdmins/{uid}` document can see content. Everyone else sees "Not authorized".
- Tabs: Open and Resolved reports. Each report shows the target developer (linked), the reason, the date, and actions: Suspend (sets `suspended: true` and `acceptingRequests: false`), Restore, Mark resolved, and Open profile.
- Every action writes an `auditLog` entry: actor, action, target, timestamp, and an optional note.

### 6.7 Embed widget (`embed.js`)
- Usage: `<script src="https://<host>/embed.js" data-username="alice" data-label="Request an app" defer></script>`.
- Renders a button inside a Shadow DOM root so host styles cannot leak in. Clicking opens an accessible dialog with an iframe of `/d/<username>`. Escape and a close button dismiss it.
- The widget does not load Firebase. `developer.html` is the only page allowed to be framed (section 8). Document it in `docs/embedding.md`.

### 6.8 Privacy page
Plain language. Cover what is stored, who can see it, how to export or delete data, and that there are no analytics, ads, or third-party trackers. The text must match what the code actually does.

---

## 7. Data model

| Path | Fields | Read | Write |
|---|---|---|---|
| `usernames/{username}` | `uid`, `createdAt` | anyone | create: the owner (claim); delete: the owner |
| `developers/{uid}` | `username`, `displayName`, `bio`, `website`, `pricingNote`, `avatarUrl`, `acceptedPlatforms[]`, `acceptingRequests`, `suspended`, `createdAt`, `updatedAt` | anyone, unless suspended | owner (not `username`, `suspended`, `createdAt`); platform admin (`suspended`, `acceptingRequests`) |
| `developers/{uid}/portfolio/{requestId}` | `title`, `appName`, `platforms[]`, `svgIcon`, `projectUrl`, `shippedAt` | anyone | owner, only for their own request with status `done` |
| `requests/{requestId}` | `developerUid`, `developerUsername`, `requesterName`, `title`, `appName`, `appDescription`, `platforms[]`, `svgIcon`, `notes`, `template`, `budgetRange`, `deadline`, `status`, `quote`, `createdAt`, `updatedAt` | by ID; list: owner only | create: anyone (validated); update: owner (`status`, `quote`) or requester (`new` to `cancelled`); delete: owner |
| `requests/{id}/private/contact` | `email`, `createdAt` | owner only | requester, at creation |
| `requests/{id}/private/notes` | `internalNotes`, `tags[]`, `updatedAt` | owner only | owner |
| `requests/{id}/messages/{msgId}` | `authorRole` (`requester` or `developer`), `body`, `createdAt` | by ID | requester (not if cancelled); owner. Delete: owner. |
| `reports/{reportId}` | `targetUid`, `reason`, `status` (`open` or `resolved`), `createdAt`, `resolvedAt` | platform admin | anyone (create); admin (`status`, `resolvedAt`) |
| `platformAdmins/{uid}` | existence only | owner | nobody from the client |
| `auditLog/{id}` | `actorUid`, `action`, `targetUid`, `note`, `createdAt` | platform admin | platform admin (create only) |

Rules for the data:
- Status values: `new`, `in_progress`, `done`, `declined`, `cancelled`.
- Platform values: `web`, `windows`, `macos`, `linux`, `android`, `ios`, `other`.
- Always write every key, using `null` for empty optional values. Rules check key sets exactly.
- Use `serverTimestamp()` for `createdAt` and `updatedAt`.
- The directory query must include `where("acceptingRequests", "==", true)` and `where("suspended", "==", false)`.
- Required composite index: `requests`, `developerUid` ascending, then `createdAt` descending. Nothing else needs one. Filter by status and platform on the client.

---

## 8. Security model

### Tracking links are bearer tokens
A request ID is 20 random characters, roughly 120 bits. Whoever holds the tracking link can read that one request, post messages, and cancel it while it is new. Nobody can list requests except their owner. This is a deliberate trade-off that lets people request apps without accounts. The UI must say "Keep this link private", and `docs/security-model.md` must describe the trade-off.

### Threats and mitigations

| Threat | Mitigation |
|---|---|
| Reading another developer's requests | `list` requires `developerUid == auth.uid`. The client is never trusted. |
| Enumerating requests | No anonymous list access. IDs are random. |
| Username squatting | A username claim requires that the caller has no developer profile yet. One username per account. Clean up orphaned claims. Recommend App Check. |
| Requests to suspended or closed developers | The create rule reads the developer document and requires `suspended == false` and `acceptingRequests == true`. |
| Requests for platforms a developer doesn't build | The create rule requires `platforms.hasOnly(acceptedPlatforms)`. |
| Spam and floods | Honeypot, client cooldown, App Check (recommended), reports, suspension. |
| Stored XSS through SVG | Sanitize on the client, check the shape in rules, render only as an `<img>` with a data URI. |
| Personal data leaking through the portfolio | The portfolio is a separate collection with curated fields. |
| CSV injection on export | Prefix any cell that starts with `=`, `+`, `-`, `@`, tab, or CR with a single quote. |
| Secrets in git | Firebase web config is public, but service-account keys never enter the repository. gitleaks runs in CI. |

### `firestore.rules` (starting point)
The agent must write rules tests that cover every `allow` and every realistic denial before this file is considered done.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- helpers ----------

    function signedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function isPlatformAdmin() {
      return signedIn()
        && exists(/databases/$(database)/documents/platformAdmins/$(request.auth.uid));
    }

    function isDevOf(requestId) {
      return signedIn()
        && get(/databases/$(database)/documents/requests/$(requestId)).data.developerUid == request.auth.uid;
    }

    function isText(v, min, max) {
      return v is string && v.size() >= min && v.size() <= max;
    }

    function isOptionalText(v, max) {
      return v == null || isText(v, 0, max);
    }

    function isEmailOrNull(v) {
      return v == null || (isText(v, 3, 254) && v.matches('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'));
    }

    function isHttpsOrNull(v, max) {
      return v == null || (v is string && v.size() <= max && v.matches('^https://.+'));
    }

    function isUsername(v) {
      return v is string
        && v.matches('^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$')
        && !(v in ['admin', 'api', 'd', 'r', 'dashboard', 'moderation', 'settings', 'login',
                   'about', 'privacy', 'support', 'help', 'static', 'assets', 'new']);
    }

    function isPlatforms(v) {
      return v is list && v.size() >= 1 && v.size() <= 7
        && v.hasOnly(['web', 'windows', 'macos', 'linux', 'android', 'ios', 'other']);
    }

    function isSvgOrNull(v) {
      return v == null || (isText(v, 10, 100000) && v.matches('(?s)^\\s*<svg.*</svg>\\s*$'));
    }

    function isQuoteOrNull(q) {
      return q == null || (q is map
        && q.keys().hasOnly(['amount', 'currency', 'timeline', 'validUntil'])
        && isText(q.amount, 1, 20)
        && isText(q.currency, 3, 3)
        && isOptionalText(q.timeline, 200)
        && (q.validUntil == null || (q.validUntil is string && q.validUntil.matches('^\\d{4}-\\d{2}-\\d{2}$'))));
    }

    function isProfile(d) {
      return d.keys().hasOnly(['username', 'displayName', 'bio', 'website', 'pricingNote', 'avatarUrl',
                               'acceptedPlatforms', 'acceptingRequests', 'suspended', 'createdAt', 'updatedAt'])
        && isText(d.displayName, 1, 60)
        && isOptionalText(d.bio, 280)
        && isOptionalText(d.pricingNote, 120)
        && isHttpsOrNull(d.website, 200)
        && isHttpsOrNull(d.avatarUrl, 500)
        && isPlatforms(d.acceptedPlatforms)
        && d.acceptingRequests is bool
        && d.suspended is bool;
    }

    function isNewRequest(d) {
      let dev = get(/databases/$(database)/documents/developers/$(d.developerUid)).data;
      return d.keys().hasOnly(['developerUid', 'developerUsername', 'requesterName', 'title', 'appName',
                               'appDescription', 'platforms', 'svgIcon', 'notes', 'template',
                               'budgetRange', 'deadline', 'status', 'quote', 'createdAt', 'updatedAt'])
        && d.keys().size() == 16
        && dev.suspended == false
        && dev.acceptingRequests == true
        && d.developerUsername == dev.username
        && isText(d.requesterName, 2, 100)
        && isText(d.title, 2, 120)
        && isText(d.appName, 2, 80)
        && isText(d.appDescription, 10, 2000)
        && isPlatforms(d.platforms)
        && d.platforms.hasOnly(dev.acceptedPlatforms)
        && isSvgOrNull(d.svgIcon)
        && isOptionalText(d.notes, 2000)
        && (d.template == null || d.template in ['landing', 'mobile', 'tool', 'extension', 'desktop', 'other'])
        && (d.budgetRange == null || d.budgetRange in ['under_500', '500_2000', '2000_10000', 'over_10000', 'unknown'])
        && (d.deadline == null || (d.deadline is string && d.deadline.matches('^\\d{4}-\\d{2}-\\d{2}$')))
        && d.status == 'new'
        && d.quote == null
        && d.createdAt == request.time
        && d.updatedAt == request.time;
    }

    function isMessage(d) {
      return d.keys().hasOnly(['authorRole', 'body', 'createdAt'])
        && d.authorRole in ['requester', 'developer']
        && isText(d.body, 1, 2000)
        && d.createdAt == request.time;
    }

    function isContact(d) {
      return d.keys().hasOnly(['email', 'createdAt'])
        && isEmailOrNull(d.email)
        && d.createdAt == request.time;
    }

    function isNotes(d) {
      return d.keys().hasOnly(['internalNotes', 'tags', 'updatedAt'])
        && isOptionalText(d.internalNotes, 5000)
        && d.tags is list && d.tags.size() <= 5
        && d.updatedAt == request.time;
    }

    // ---------- usernames and developers ----------

    match /usernames/{username} {
      allow get, list: if true;
      allow create: if signedIn()
        && isUsername(username)
        && !exists(/databases/$(database)/documents/developers/$(request.auth.uid))
        && request.resource.data.keys().hasOnly(['uid', 'createdAt'])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.createdAt == request.time;
      allow delete: if isOwner(resource.data.uid);
    }

    match /developers/{uid} {
      allow get: if resource == null || isOwner(uid) || resource.data.suspended == false || isPlatformAdmin();
      allow list: if resource.data.suspended == false || isPlatformAdmin();

      allow create: if isOwner(uid)
        && isUsername(request.resource.data.username)
        && exists(/databases/$(database)/documents/usernames/$(request.resource.data.username))
        && get(/databases/$(database)/documents/usernames/$(request.resource.data.username)).data.uid == uid
        && request.resource.data.suspended == false
        && request.resource.data.acceptingRequests == true
        && isProfile(request.resource.data)
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if isOwner(uid)
        && request.resource.data.username == resource.data.username
        && request.resource.data.suspended == resource.data.suspended
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt == request.time
        && isProfile(request.resource.data);

      allow update: if isPlatformAdmin()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['suspended', 'acceptingRequests', 'updatedAt']);

      allow delete: if isOwner(uid);

      match /portfolio/{requestId} {
        allow read: if true;
        allow delete: if isOwner(uid);
        allow create, update: if isOwner(uid)
          && get(/databases/$(database)/documents/requests/$(requestId)).data.developerUid == uid
          && get(/databases/$(database)/documents/requests/$(requestId)).data.status == 'done'
          && request.resource.data.keys().hasOnly(['title', 'appName', 'platforms', 'svgIcon', 'projectUrl', 'shippedAt'])
          && isText(request.resource.data.title, 2, 120)
          && isText(request.resource.data.appName, 2, 80)
          && isPlatforms(request.resource.data.platforms)
          && isSvgOrNull(request.resource.data.svgIcon)
          && isHttpsOrNull(request.resource.data.projectUrl, 300)
          && request.resource.data.shippedAt is timestamp;
      }
    }

    // ---------- requests ----------

    match /requests/{requestId} {
      allow get: if true;
      allow list: if signedIn() && resource.data.developerUid == request.auth.uid;
      allow create: if isNewRequest(request.resource.data);

      // Developer: change status and quote.
      allow update: if signedIn()
        && resource.data.developerUid == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'quote', 'updatedAt'])
        && request.resource.data.status in ['new', 'in_progress', 'done', 'declined', 'cancelled']
        && request.resource.data.updatedAt == request.time
        && isQuoteOrNull(request.resource.data.quote);

      // Requester: cancel while still new. Access is by possession of the ID.
      allow update: if resource.data.status == 'new'
        && request.resource.data.status == 'cancelled'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedAt'])
        && request.resource.data.updatedAt == request.time;

      allow delete: if signedIn() && resource.data.developerUid == request.auth.uid;

      match /private/{docId} {
        allow read, delete: if isDevOf(requestId);
        allow create: if (docId == 'contact' && isContact(request.resource.data))
          || (docId == 'notes' && isDevOf(requestId) && isNotes(request.resource.data));
        allow update: if docId == 'notes' && isDevOf(requestId) && isNotes(request.resource.data);
      }

      match /messages/{messageId} {
        allow read: if true;
        allow create: if isMessage(request.resource.data)
          && ((request.resource.data.authorRole == 'requester'
                && get(/databases/$(database)/documents/requests/$(requestId)).data.status != 'cancelled')
              || (request.resource.data.authorRole == 'developer' && isDevOf(requestId)));
        allow delete: if isDevOf(requestId);
      }
    }

    // ---------- moderation ----------

    match /reports/{reportId} {
      allow create: if request.resource.data.keys().hasOnly(['targetUid', 'reason', 'status', 'createdAt'])
        && request.resource.data.targetUid is string
        && isText(request.resource.data.reason, 10, 1000)
        && request.resource.data.status == 'open'
        && request.resource.data.createdAt == request.time;
      allow read, delete: if isPlatformAdmin();
      allow update: if isPlatformAdmin()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'resolvedAt']);
    }

    match /auditLog/{entryId} {
      allow read: if isPlatformAdmin();
      allow create: if isPlatformAdmin()
        && request.resource.data.actorUid == request.auth.uid
        && request.resource.data.createdAt == request.time;
    }

    match /platformAdmins/{uid} {
      allow get: if isOwner(uid);
    }
  }
}
```

### Headers (`firebase.json`)
- `Content-Security-Policy`: no inline scripts, and no `unsafe-eval`. Allow `'self'` and `https://www.gstatic.com` for scripts. Allow `data:` for images only. Allow Google and Firebase endpoints for `connect-src`, and `*.firebaseapp.com` for `frame-src` (the sign-in popup). Verify sign-in and Firestore work under the CSP with no console violations.
- `frame-ancestors 'none'` on every page except `/d/**`, which must allow framing (`frame-ancestors *`) because the embed widget iframes it.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera, microphone, and geolocation, and `Strict-Transport-Security`.

---

## 9. SVG handling

1. Accept an uploaded file (up to 100 KB, type `image/svg+xml` or `.svg` extension) or pasted text (up to 100 KB).
2. Trim the input. It must start with `<svg`, optionally after an XML prolog.
3. Sanitize with DOMPurify:
   ```js
   DOMPurify.sanitize(input, {
     USE_PROFILES: { svg: true, svgFilters: true },
     FORBID_TAGS: ['script', 'foreignObject', 'use', 'animate', 'set', 'iframe', 'embed', 'object'],
   });
   ```
4. Parse the result with `DOMParser` as `image/svg+xml`. Reject it if a `parsererror` element exists or the root element is not `svg`.
5. Store the sanitized string. Render it only as `<img src="data:image/svg+xml;charset=utf-8,...">` using `encodeURIComponent`. Never insert it with `innerHTML`.
6. Unit tests must cover: `<script>`, `onload=` attributes, `<foreignObject>`, `<use href="https://...">`, `href="javascript:..."`, `<a>` wrapping, deep nesting, the exact 100 KB boundary, and non-SVG HTML.

---

## 10. Firebase setup (maintainers and self-hosters)

1. Create a Firebase project. Enable **Authentication → Google**, and add the Hosting domain and `localhost` to the authorized domains.
2. Create **Firestore** in Native mode.
3. Copy `.firebaserc.example` to `.firebaserc` and set your project ID. `.firebaserc` is git-ignored.
4. Put the web app config into `public/js/firebase-config.js`. The committed file has placeholders. Each fork keeps its own values.
5. Deploy rules and indexes: `firebase deploy --only firestore`.
6. Create the first platform admin. Sign in once, copy your UID from the Authentication console, and create `platformAdmins/<uid>` in Firestore by hand.
7. Deploy Hosting: `firebase deploy --only hosting`.
8. Optional: enable App Check (reCAPTCHA Enterprise or reCAPTCHA v3) and enforce it for Firestore.

`firebase.json` (keep the headers from section 8 in the `hosting` block):

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "public",
    "cleanUrls": true,
    "trailingSlash": false,
    "rewrites": [
      { "source": "/d/**", "destination": "/developer.html" },
      { "source": "/r/**", "destination": "/track.html" }
    ]
  },
  "emulators": {
    "singleProjectMode": true,
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

`firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "developerUid", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

`public/js/firebase-config.js` connects to the emulators when `location.hostname` is `localhost` or `127.0.0.1`: `connectAuthEmulator(auth, "http://127.0.0.1:9099")` and `connectFirestoreEmulator(db, "127.0.0.1", 8080)`.

---

## 11. Local development and testing

```
npm ci
npm run emulators        # auth 9099, firestore 8080, hosting 5000, UI 4000
npm run seed             # demo developers, requests, messages. Refuses to run without emulators.
npm test                 # unit and rules tests
npm run test:e2e         # Playwright against the emulators
npm run lint
npm run format:check
```

**Unit tests** cover: username and email validation, text length limits, platform subsets, the SVG sanitizer cases in section 9, CSV escaping, Markdown brief generation, and date formatting.

**Rules tests** (`@firebase/rules-unit-testing`) cover at least one allowed case and one denied case for every row in section 7. Include cross-owner reads, writes to suspended developers, cancelling after `in_progress`, platforms outside the accepted list, oversized SVG, missing keys, and extra keys.

**End-to-end tests** (Playwright, using the Auth emulator's Google sign-in):
1. A developer signs in and claims a username.
2. A requester submits through `/d/<username>` and receives a tracking link.
3. The developer moves the request to In progress, sends a quote, and replies.
4. The requester sees the quote and reply appear live.
5. The requester cancels a new request.
6. An SVG containing a script is stripped.
7. A suspended developer's page shows no form.
8. axe reports zero serious or critical violations on every page.

---

## 12. Internationalization

- `public/locales/en.json` is the source of truth. Every user-visible string goes through `t("key", params)`. A missing key falls back to English and logs a warning in development.
- Static HTML uses `data-i18n="key"` and `data-i18n-attr="placeholder:key"`, applied on load.
- `<html lang>` and `dir` follow the active locale. `he` and `ar` are RTL.
- Use `Intl.PluralRules`, `Intl.RelativeTimeFormat`, and `Intl.DateTimeFormat` for plurals, relative times, and dates.
- Ship `he.json` as a complete translation. CI fails if any key in `en.json` is missing from `he.json`.
- `docs/i18n.md` explains how to add a language.

---

## 13. Additional features (required, added on purpose)

The owner wants more than the brief describes. Build all of the following, within section 0 and section 8:

1. **Kanban board** with drag and drop and keyboard moves (6.5).
2. **Quotes** shown to requesters on the tracking page.
3. **Two-way message thread** between requester and developer, updating live.
4. **Private internal notes and tags** that never reach the public page or the requester.
5. **Public portfolio** of shipped work, opt-in per request.
6. **Developer directory** with search, sorting, and pagination.
7. **Request templates** that prefill a starter description.
8. **Budget range and deadline** fields.
9. **Draft autosave, review step, and submission cooldown** on the form.
10. **Markdown brief export** ("Copy brief as Markdown"), for pasting into an issue tracker or notes.
11. **CSV and JSON export** of requests, with CSV-injection protection.
12. **Unread indicators**, a document-title counter, a toast on new requests, and optional browser notifications.
13. **Keyboard shortcuts** with a help dialog.
14. **URL-synced filters and view mode**, so dashboard views can be bookmarked.
15. **Dark mode**, system-preference detection, and a language switcher (English by default, Hebrew included, RTL correct).
16. **Reports, a moderation page, suspension, and an audit log.**
17. **Data export and account deletion** as a privacy right, with a clear cascade.
18. **Embeddable "Request an app" button** (`embed.js`, Shadow DOM, no Firebase).
19. **Installable PWA** for the dashboard, with the app shell cached offline. Never cache Firestore data.
20. **Shareable developer link** with copy and Web Share, plus an optional QR code from a vendored MIT-licensed library.
21. **Demo data seeding and reset scripts** for the emulator.
22. **Optional email notifications** in a separate `functions/` folder. Blaze only, off by default, fully documented.
23. **Security hardening:** strict CSP, security headers, `/.well-known/security.txt`, gitleaks in CI, CodeQL workflow, Dependabot for npm and GitHub Actions.
24. **SEO basics:** meta and Open Graph tags, `robots.txt`, `sitemap.xml`, canonical URLs.
25. **Performance budgets:** no framework, lazy-loaded page modules, Lighthouse CI thresholds. Mobile Performance at 90 or higher on the landing page and the dashboard. Accessibility, Best Practices, and SEO at 95 or higher.
26. **Contributor experience:** `.devcontainer`, issue forms, a PR template with a checklist, CODEOWNERS, labels, and a "good first issue" list in `ROADMAP.md`.
27. **Architecture documentation:** `docs/architecture.md` with a Mermaid diagram, and an ADR for every major decision.

**Think big within these rules.** If you find a clearly valuable addition that fits sections 0 and 8, build it. Record it under `Unreleased` in `CHANGELOG.md`, and add it to `ROADMAP.md`.

---

## 14. Build phases

Build in order. Each phase ends in a working, tested state with a commit.

**Phase 0: Open-source foundation.** Create the repository files from section 3. Pin `package.json`. Set up ESLint, Prettier, EditorConfig, and `.gitignore`. Write LICENSE (MIT, copyright holder `<YOUR NAME>` as a placeholder). Write the README skeleton, CODE_OF_CONDUCT (Contributor Covenant 2.1, copied from the official text, with a contact placeholder), SECURITY.md, and CONTRIBUTING.md. Add the CI skeleton. Start the emulators.
*Done when:* `npm ci`, `npm run lint`, and `npm run emulators` all succeed.

**Phase 1: Core product.** Firebase SDK wrapper and config. Design tokens and base components. Landing page with find-by-username. Developer onboarding and username claim. Developer public page. Request form with validation and submit. Tracking page (read-only status). Dashboard list view. Request drawer with status change. Firestore rules, indexes, and rules tests.
*Done when:* in the emulator, a requester submits a request and the developer sees it, and the rules tests pass.

**Phase 2: Collaboration.** Kanban board. Filters synced to the URL. Messages in both directions. Quotes. Private notes and tags. Cancel. Delete with cascade. Draft autosave, review step, and cooldown. Unread indicators. Toasts. Keyboard shortcuts. Markdown brief. CSV and JSON export.
*Done when:* E2E scenarios 1 through 5 pass.

**Phase 3: Platform.** Portfolio. Settings. Account deletion. Reports and moderation with audit log. Directory with search and pagination. Embed widget. Hebrew locale with RTL checked. Dark mode. PWA shell. SEO files. Security headers, with CSP verified in the emulator and the preview build.
*Done when:* E2E scenarios 6 through 8 pass, and the security headers are present on the served pages.

**Phase 4: Polish and release.** Accessibility pass: axe clean, and a manual keyboard walkthrough. Performance pass: Lighthouse CI thresholds met. Screenshots for the README, generated with Playwright into `docs/screenshots/`. Complete docs and ADRs. CHANGELOG entry `0.1.0`. ROADMAP with good first issues. Release notes. Tag `v0.1.0`.
*Done when:* CI is green on a clean clone, and a new contributor can follow the README to a running app in under 10 minutes.

---

## 15. Definition of done

- [ ] `npm ci && npm run lint && npm test && npm run test:e2e` pass on a clean clone.
- [ ] No inline scripts, no inline event handlers, and no `innerHTML` with user data. Verify with grep.
- [ ] Every user-visible string exists in both `en.json` and `he.json`.
- [ ] Every page works at 360 px width with no horizontal scroll, and with the keyboard alone.
- [ ] Every rule in `firestore.rules` has at least one rules test.
- [ ] No secrets, service-account files, or real project IDs in the git history.
- [ ] README covers: what the project is, screenshots, features, quick start (under 10 minutes), self-hosting, architecture link, security model link, and license.
- [ ] `CHANGELOG.md` has `0.1.0`. `ROADMAP.md` lists next steps and good first issues.
- [ ] Every decision the file did not specify is recorded in `docs/decisions/`.

---

## 16. Final report from the builder

End with a short report: what was built, what was skipped and why, the real test output, the decisions made without this file, and every place where the rules had to differ from section 8, with the reason.
