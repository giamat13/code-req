# 0008: Add `lastMessageAt` to requests

- Status: Accepted
- Date: 2026-10-21

## Context

The developer board marks a request as unread when a requester writes something new. Subscribing to every message thread from the board would be expensive, and a collection-group query over messages would need extra indexes and rules.

## Decision

Each request document has a `lastMessageAt` timestamp. Sending a message writes the message and sets `lastMessageAt` in one batch. Firestore rules allow an update that changes only `lastMessageAt`, to the server time, by anyone who can write to the request. This is the same bearer-token model as ADR 0003.

## Consequences

- This adds a field to the data model in `PROMPT.md`. The rules, the data model documentation, and the rules tests all include it.
- Anyone with a tracking link can bump the timestamp. That is harmless, because it only changes the sort and unread state.
