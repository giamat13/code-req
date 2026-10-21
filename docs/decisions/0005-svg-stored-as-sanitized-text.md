# 0005: SVG icons are stored as sanitized text

- Status: Accepted
- Date: 2026-10-21

## Context

A requester can attach an SVG icon. An SVG file can run script, so an uploaded file that the site serves from its own origin is a stored cross-site scripting risk. Cloud Storage also needs the Blaze plan for new buckets (see ADR 0002).

## Decision

The client reads the SVG (up to 100 KB), sanitizes it with DOMPurify using the SVG profile, parses the result, and stores the sanitized markup as a string in the request document. Every place that shows an icon renders it as `<img src="data:image/svg+xml;...">`. Scripts inside an `<img>` never run, and the site never inserts icon markup with `innerHTML`.

## Consequences

- Firestore rules check the shape of the stored string (it must start with `<svg` and end with `</svg>`), but they cannot sanitize it. The client is the first line of defense, and the rendering method is the second.
- The size limit keeps each request document well below Firestore's 1 MiB limit.
