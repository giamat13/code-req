# 0010: The embed button opens the developer page in a new tab

- Status: Accepted
- Date: 2026-10-21

## Context

The embeddable "Request an app" button could open the developer page in an overlay iframe. The site sends `X-Frame-Options: DENY` on Firebase, to protect the dashboard from clickjacking, and GitHub Pages cannot send any frame policy at all.

## Decision

The embed widget opens `developer.html?u=<username>` in a new tab with `noopener`. It does not use an iframe.

## Consequences

- The widget works on both hosts without changing the frame policy.
- The overlay design from the original plan is deferred. It could come back later with a narrower policy on the developer page only.
