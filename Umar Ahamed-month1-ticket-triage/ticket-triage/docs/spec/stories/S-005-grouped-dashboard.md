# S-005 — Read the board grouped by priority, with counts

- **FR:** FR-4 · **Goals:** G-4, G-5 · **NFR:** NFR-1 · **Tasks:** T7, T8

> **As** the Delivery Director in the Monday review,
> **I want** the board grouped P0 / P1 / P2 / Untriaged with a count on each group,
> **so that** I can answer "what is on fire and how much is unowned" without
> reading every row.

## Acceptance criteria

Inherits **AC-4.1 … AC-4.4** from PRD §4. Summarised:

- Exactly four groups, always in the order P0, P1, P2, Untriaged.
- Every group shows a count badge — including empty groups, which show `0` and an
  empty-state line. A missing P0 heading is indistinguishable from a bug.
- The four badges sum to the total shown in the page header.
- Within a group, tickets are ordered by `createdAt` ascending.
- All four group headings fit above the fold at 1366×768 (G-4).
- First render ≤ 1500 ms on localhost after `pnpm build && pnpm start` (NFR-1).

## Notes

Grouping is a pure function in `src/lib/grouping.ts` so it can be unit-tested
without rendering, and so the empty-group and ordering rules are asserted rather
than eyeballed.

## Done when

`tests/grouping.test.ts` passes and the rendered page matches the four-group
layout.
