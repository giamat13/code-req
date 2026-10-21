# 0015: Developers add their own platforms, and "Other" takes a name

- Status: Accepted
- Date: 2026-10-21

## Context

The platform list was fixed, so a developer who builds for a device that is not listed could not say so. Requesters also need a clear way to describe their budget when they cannot pay, such as a volunteer project.

## Decision

- **Platform list.** The built-in platforms stay (web, windows, macos, linux, android, ios, other). Choosing **Other** asks the developer to write what the platform is. The name is added to the developer's accepted platforms, and Other is replaced by that name. A developer can add up to ten names of their own, and accept up to twenty platforms in total.
- **Names are checked in the app.** Each name is trimmed, must be at most 30 characters, cannot repeat a built-in platform or another name, and is displayed as text.
- **Rules.** Firestore rules cannot loop over a list, so they check only the size of a platform list (at most 20). A request's platforms must still be a subset of the developer's accepted list, which the rules enforce with `hasOnly`. Names the developer writes are therefore not checked against a pattern in the rules.
- **Budget.** The budget options gain "Free" (`free`), for projects that do not pay.

## Consequences

- Unit tests cover the name checks, and the rules tests cover accepting a custom platform, rejecting one the developer does not accept, the twenty-platform limit, and the free budget.
- The rules accept any text as a platform name. Length and count limits are enforced in the app, and document size is capped by Firestore, so the risk is limited to storage.
- Built-in platform ids keep their English names in the data, so filters and exports stay stable across languages.
