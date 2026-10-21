# 0004: The username is the developer's code

- Status: Accepted
- Date: 2026-10-21

## Context

Requesters arrive in two ways: through a developer's link, or by typing a developer's code on the landing page. A code that people can type should be short, readable, and unique.

## Decision

The developer's username is the code. It is 3 to 30 characters, lowercase letters, digits, and hyphens, and it cannot start or end with a hyphen. A reserved list blocks names such as `admin` and `support`. A claim creates a `usernames/{username}` document first. Firestore rejects a create on an existing document, which makes the claim atomic.

## Consequences

- Usernames cannot change after a claim, because links depend on them. Changing one means deleting the account and claiming a new name.
- The reserved list exists in two places: `public/js/domain/usernames.js` and `firestore.rules`. Both must match, and the rules tests check that.
