# 0007: Query-string routes so the site works on GitHub Pages

- Status: Accepted
- Date: 2026-10-21

## Context

The site must work on GitHub Pages as well as Firebase Hosting. GitHub Pages serves a project site under a subpath such as `/code-req/`, cannot rewrite paths to a single entry page, and cannot set response headers. Path-based routes such as `/d/<username>` therefore fail on GitHub Pages without a single-page-app redirect workaround.

## Decision

Routes are real files with query parameters:

| Page                            | Route                         |
| ------------------------------- | ----------------------------- |
| Landing                         | `index.html`                  |
| Developer page and request form | `developer.html?u=<username>` |
| Tracking page                   | `track.html?r=<requestId>`    |
| Developer dashboard             | `dashboard.html`              |
| Moderation                      | `moderation.html`             |
| Privacy                         | `privacy.html`                |

All links are relative (`./css/...`, `developer.html?u=...`), and every internal link names its `.html` file. The Firebase rewrites for `/d/**` and `/r/**` are not used.

## Consequences

- Both hosts serve the same files without special configuration.
- Developer links look like `https://<host>/developer.html?u=alice`, which is less pretty than `/d/alice`.
- The URL changes only through query parameters, so dashboard filters can use `history.replaceState` safely.
