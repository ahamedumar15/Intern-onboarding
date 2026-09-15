# ADR-002 — Data layer: Prisma + SQLite

- **Status:** Accepted
- **Date:** 2026-08-30
- **Deciders:** Umar Ahamed (Intern), PMO sponsor
- **Relates to:** FR-1, FR-2, FR-3, NFR-2, NFR-3, NFR-4, PRD §6

## Context

The data need for Month 1 is small and well-bounded:

- One entity (`Ticket`, ten fields — PRD §6), seeded from
  `prisma/seed/tickets.json` (24 rows).
- Reads are always "filter by `status`, order by `createdAt`" (FR-1, FR-4);
  writes are always "update `priority` / `owner` / `status` on one row by id"
  (FR-2, FR-3). No joins, no reporting queries, no aggregation beyond counting.
- Fewer than ten concurrent users (a 6-person PMO), effectively zero write
  contention — the write burst is one coordinator tagging rows on a Monday.
- **NFR-2** requires p95 ≤ 150 ms per request, **NFR-3** requires zero `any`, and
  **NFR-4** caps CI at 180 s.
- NG-8 rules out multi-tenancy, so there is exactly one database file.

The dominant force is NFR-3. The data layer is where untyped values enter a
TypeScript program, so whatever we pick has to generate its own types.

## Decision

Use **Prisma ORM 6 with the `sqlite` provider**, database file at
`prisma/dev.db` (git-ignored), schema at `prisma/schema.prisma` generated from
PRD §6, and a `prisma/seed.ts` that **upserts on `reference`** so re-seeding is
idempotent (AC-1.5).

Prisma access is confined to `src/server/repository/ticket-repository.ts`, which
implements a small `TicketRepository` interface. The route handlers depend on
that interface, not on Prisma — so the unit tests in `tests/` run against an
in-memory fake with no database, no migration and no `prisma generate` step.

## Alternatives considered

### A. `better-sqlite3` with hand-written SQL — **rejected**

- Materially faster and about 90% smaller to install; on raw numbers it wins
  NFR-2 and NFR-4 outright.
- Rejected on NFR-3: `db.prepare(...).all()` returns `unknown[]`. Every read
  needs a hand-written type assertion, and an assertion is a lie the compiler
  cannot check — the exact failure mode "zero `any` types" is meant to prevent.
  We would end up writing Zod parsers for every row just to get back the safety
  Prisma gives for free, at which point the size advantage is gone.
- Also rejected because there is no migration story; PRD §6 changes would be
  applied by hand.

### B. PostgreSQL (Docker locally, service container in CI) — **rejected**

- The right answer for production and for the eventual multi-squad rollout.
- Rejected for Month 1 on NFR-4: pulling and health-checking a Postgres service
  container costs 30–60 s of the 180 s CI budget, to serve one table with 24
  rows. It also makes "clone and run" a Docker prerequisite, which breaks the
  README's 10-minute regeneration promise for a reviewer without Docker.
- *Migration path:* because Prisma was chosen, switching is a `provider` change
  plus a new migration — and PRD §6's `String` columns become real enums. This
  is the main reason Prisma beat option A even though A is faster.

### C. Plain JSON file as the store (read/write `tickets.json`) — **rejected**

- Zero dependencies, and the seed file is already JSON, so it looks like the
  cheapest possible thing.
- Rejected on correctness: two concurrent PATCHes read-modify-write the same
  file and one update is silently lost. FR-2 and FR-3 are *both* write paths hit
  during the same triage session, so this is a realistic Monday-morning bug, not
  a theoretical one. There is also no index, no constraint enforcing
  `reference` uniqueness (AC-1.5), and no way to express PRD §6's index.

### D. Drizzle ORM + SQLite — **rejected, but close**

- Fully typed like Prisma, smaller, and no code-generation step — genuinely
  attractive against NFR-4.
- Rejected because the brief names Prisma as the stack constraint, and because
  Prisma's `migrate dev` / `migrate deploy` split gives a clearer "migration
  runs clean" story for Deliverable 2. Worth revisiting if `prisma generate`
  ever becomes the CI bottleneck.

## Consequences

**Positive**

- `prisma generate` produces `Ticket` types directly from PRD §6, so a schema
  drift breaks the build. NFR-3 is enforced by construction, not by review.
- SQLite is a file: CI needs no service container, and `pnpm db:reset` restores
  a known state in seconds. This is what keeps NFR-4 achievable.
- The repository interface keeps the unit tests DB-free, so `pnpm test` is fast
  and deterministic in CI.
- With 24 rows and an index on `(status, priority)`, NFR-2's 150 ms budget is
  dominated by framework overhead, not by the query.

**Negative / accepted costs**

- **Prisma does not support `enum` on SQLite.** `status` and `priority` are
  `String` columns. The database will accept `"P9"`; only the Zod boundary
  stops it (ADR-003). Consequence: *every* write path must go through
  `UpdateTicketSchema` — there is no second line of defence. This is recorded as
  the primary risk of this ADR.
- `prisma generate` must run before `tsc`, so `postinstall` and the CI job both
  need it. Forgetting it produces a confusing "Cannot find module '@prisma/client'"
  rather than a clear error.
- SQLite has a single writer. Fine at PMO scale (NG-8), and a hard blocker for
  any multi-tenant future — which is precisely why option B's migration path was
  a selection criterion.
- The `.db` file must stay git-ignored (NFR-6), otherwise the repo accumulates
  binary churn and leaks whatever the PMO typed into it.

## Verification

- `pnpm db:reset` (migrate reset + seed) must exit 0 from a clean checkout.
- AC-1.5 verified by running `pnpm db:seed` twice and comparing row counts.
- NFR-2 measured by `pnpm bench`; result recorded in the CI report.
