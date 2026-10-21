# 0017: The budget is a whole-number range, not a choice of bands

- Status: Accepted
- Date: 2026-10-21

## Context

A requester picked one of fixed bands (under 500, 500–2,000, and so on). The bands were too coarse for developers to know whether a request was worth a quote, and they had to be kept in step across the constants, the rules, the translations, and the filters.

## Decision

- **Two fields replace `budgetRange`.** `budgetMin` and `budgetMax` are whole numbers in the developer's own currency, or `null`. Both are `null` when no budget was given. A range needs both ends, and the top cannot be below the bottom.
- **Free is 0 to 0.** A project that does not pay is written as a range of zero. A range whose top is 0 is shown as "Free".
- **Limit.** Each end is at most 10,000,000. The rules and the app enforce the same limit.
- **No currency field.** The developer quotes in their own currency, so the requester does not name one.
- **The budget filter is gone.** A filter over bands has nothing to match. Sorting by budget uses the top of the range, and a request with no budget sorts as 0.

## Consequences

- The request keeps 19 keys, so `isNewRequest` still checks for 19.
- Requests written with `budgetRange` before this change are not migrated. Their budget reads as not given until the requester or developer sets one. The app is pre-launch, so no migration is planned.
- The rules check that both ends are whole numbers in range and that they are either both `null` or both set, so the one-sided case is rejected in both places.
- ADR 0015 still describes the "Free" band as it was. The free budget keeps the same meaning under this ADR.
