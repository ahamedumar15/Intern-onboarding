# S-002 — A typed contract shared by the API and the dashboard

- **FR:** FR-5 · **NFRs:** NFR-3, NFR-8 · **Tasks:** T4

> **As** the developer who inherits this repo next month,
> **I want** one file that defines every shape crossing the HTTP boundary,
> **so that** changing an allowed priority value breaks the build instead of
> silently corrupting the board.

## Acceptance criteria

- `src/lib/contracts.ts` exports `PrioritySchema`, `StatusSchema`,
  `TicketSchema`, `ListQuerySchema`, `UpdateTicketSchema`, `ApiErrorSchema`.
- The TypeScript types `Priority`, `Status`, `Ticket` are derived via `z.infer` —
  the allowed values appear exactly once in the codebase.
- `UpdateTicketSchema` is `.strict()` (AC-5.2).
- Non-2xx responses all match `ApiErrorSchema`: `{ error: { code, message, details? } }` (NFR-8).
- `grep -rn ": any\|as any\|<any>" src/` returns nothing (NFR-3).

## Notes

Load-bearing because ADR-002 accepted that SQLite cannot enforce the enum.
This file is the only thing preventing `priority = "P9"` reaching the database.

## Done when

`pnpm typecheck` and `pnpm lint` are clean, and `tests/contracts.test.ts` passes.
