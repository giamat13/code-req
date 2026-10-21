# 0014: Requesters can edit their request and leave contact details

- Status: Accepted
- Date: 2026-10-21

## Context

A requester often thinks of more detail after sending a request, and developers need a reliable way to reach them. Requesters have no accounts, so the tracking link must carry these abilities (ADR 0003).

## Decision

- **Edits.** A requester can change the content fields (names, title, description, platforms, icon, notes, template, budget, deadline) while the request is `new` or `in_progress`. The list of editable fields is `EDITABLE_FIELDS` in `public/js/domain/constants.js`, and the rules mirror it. Each edit adds a notice to the thread that names the changed fields.
- **Contact details.** A requester can store an email, a phone number, a preferred channel (email, phone, or the message thread), and availability notes. They go in `requests/{id}/private/contact`. The requester can write this document but cannot read it back. Only the developer can read it.
- **Flag.** The request document stores `hasContact`, a boolean, so the tracking page can say whether a way to reach the requester is on file without exposing it.
- **Timing.** Contact details can be updated at any status, including `done`, so the requester can stay in touch after delivery.
- **Thread.** Changing contact details adds a notice to the thread without the details themselves.

## Consequences

- The data model gains `hasContact` (18 fields in a new request) and the `kind` field on messages (`edit`, `contact`, or none). Both are in the rules and the rules tests.
- Anyone with a tracking link can edit that request and its contact details. This extends ADR 0003, and the UI tells requesters to keep the link private.
- Requesters can overwrite their own contact details, but they cannot see what is stored. The tracking page explains this.
