# ADR-003 — Validation: Zod schemas as the single contract

- **Status:** Accepted
- **Date:** 2026-08-30
- **Deciders:** Umar Ahamed (Intern)
- **Relates to:** FR-5, NFR-3, NFR-5, NFR-8; consequence of ADR-002

## Context

ADR-002 accepted a real hole: SQLite has no enums, so the database will happily
store `priority = "P9"`. The only thing standing between a malformed request and
a corrupted board is the validation layer, which makes this decision load-bearing
rather than incidental.

Meanwhile NFR-3 forbids `any`. The two places untyped data enters this program
are the database (handled by Prisma) and the HTTP boundary — where
`await request.json()` returns `any` by definition.

## Decision

**Zod 3** schemas in `src/lib/contracts.ts` are the single source of truth for
every shape crossing a boundary. Specifically:

- `PrioritySchema` / `StatusSchema` are Zod enums, and the TypeScript union types
  `Priority` and `Status` are **derived** from them with `z.infer` — so the
  allowed values are written down exactly once.
- `UpdateTicketSchema` is `.strict()`, so unknown keys are a `400` rather than
  being silently dropped (AC-5.2). Silently ignoring a typo'd field is how a
  PMO user concludes "the tool doesn't save my edits".
- `ApiErrorSchema` fixes the error envelope `{ error: { code, message, details? } }`
  for every non-2xx response (NFR-8).
- `request.json()` is wrapped in `parseJsonBody`, which catches the syntax error
  and returns `INVALID_JSON` as a `400` instead of letting it become a 500
  (AC-5.5).

The dashboard imports the same schemas it validates against, so a schema change
is a compile error on both sides simultaneously.

## Alternatives considered

### A. TypeScript interfaces only, no runtime validation — **rejected**

- Zero runtime cost and zero dependency.
- Rejected outright: TypeScript types are erased at build time. Combined with
  ADR-002's missing enums, this leaves *nothing* checking `priority` at any layer
  — `{"priority":"P9"}` would be persisted. It fails AC-2.3 by construction.

### B. Validation inside the Prisma layer / a database CHECK constraint — **rejected for now**

- A `CHECK (priority IN ('P0','P1','P2'))` constraint would be a genuine second
  line of defence and directly patches ADR-002's risk.
- Rejected for Month 1 because Prisma's SQLite provider cannot express CHECK
  constraints in `schema.prisma`; it needs a hand-edited migration SQL file, and
  the brief forbids manual edits before Deliverable 4. **Logged as the first
  follow-up for Month 2** — it is the cheapest way to close the ADR-002 risk.

### C. `class-validator` / decorators — **rejected**

- Requires `experimentalDecorators` and `reflect-metadata`, and the validated
  type lives on a class rather than being inferred. It pushes toward
  `plainToInstance(...) as SomeType` casts, which is the `any`-adjacent pattern
  NFR-3 exists to prevent.

### D. Hand-written type guards (`function isPriority(x: unknown): x is Priority`) — **rejected**

- No dependency, fully typed, and honestly fine for one enum.
- Rejected because a hand-written guard produces no structured error `details`,
  so AC-2.3's "the body names `priority` as the failing field" would have to be
  hand-built for every field. Zod's `issues` array gives that for free, and the
  guards would need updating in two places every time PRD §6 changes.

## Consequences

**Positive**

- Exactly one place to change an allowed value, and the TypeScript union follows
  automatically.
- `.strict()` turns client typos into loud 400s rather than silent no-ops.
- Zod's `issues` map straight onto NFR-8's `details`, so the error contract is
  uniform without per-route error code.
- Route handlers can be tested with plain `Request` objects and no database
  (ADR-002), because validation is pure.

**Negative / accepted costs**

- Zod is the *only* thing preventing bad enum values reaching the database. If a
  future write path skips `UpdateTicketSchema`, the data corrupts silently. Two
  mitigations: all Prisma writes are confined to
  `src/server/repository/ticket-repository.ts`, and `tests/routes.tickets.test.ts`
  asserts the rejection cases. Alternative B remains the real fix.
- Schemas are parsed on every request. At 24 rows this is well inside NFR-2's
  150 ms; it would need re-measuring at a few thousand tickets.
- Zod 3 was chosen over Zod 4 deliberately — the API is the one this codebase was
  written against, and a major-version difference in `.strict()` / error-shape
  behaviour would be an unforced risk inside a 3-hour budget.
