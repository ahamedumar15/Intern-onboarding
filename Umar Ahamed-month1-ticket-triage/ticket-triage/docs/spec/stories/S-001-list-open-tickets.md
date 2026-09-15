# S-001 — See every open ticket in one place

- **FR:** FR-1 · **Goals:** G-1, G-4 · **Tasks:** T2, T3, T5

> **As** Nadeesha, the PMO Coordinator,
> **I want** every open delivery-blocker ticket on one page,
> **so that** I stop rebuilding the triage sheet by hand every Monday (41 min → ≤ 5 min).

## Acceptance criteria

Inherits **AC-1.1 … AC-1.5** from PRD §4 FR-1. Summarised:

- `/tickets` renders all `status = "OPEN"` tickets and no `CLOSED` ones.
- `GET /api/tickets` returns the same set as JSON; `?status=CLOSED` returns the closed set.
- `?status=BANANA` is a `400 INVALID_QUERY` with no database read.
- Re-running the seed upserts on `reference` and does not duplicate rows.

## Notes

- Source of truth for Month 1 is `prisma/seed/tickets.json` (NG-4 — no Jira sync).
- Ordering is `createdAt` ascending so the oldest blocker is read first (AC-4.4).

## Done when

`pnpm db:reset && pnpm dev`, open `/tickets`, and the 24 seeded tickets are
visible without any manual data entry.
