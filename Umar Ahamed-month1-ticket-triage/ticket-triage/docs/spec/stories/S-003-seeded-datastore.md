# S-003 — A datastore that any reviewer can recreate in one command

- **FR:** FR-1 · **NFRs:** NFR-4, NFR-6 · **Tasks:** T2, T3

> **As** a reviewer cloning this repo cold,
> **I want** one command that creates the schema and loads realistic data,
> **so that** I can see the dashboard working in under 10 minutes without asking
> anyone for a database.

## Acceptance criteria

- `prisma/schema.prisma` contains the `Ticket` model with **exactly** the ten
  fields in PRD §6 and the `(status, priority)` index — no extra fields.
- `pnpm db:reset` runs `prisma migrate reset --force` then the seed, exits 0
  from a clean checkout, and needs no Docker.
- The seed reads `prisma/seed/tickets.json` and **upserts on `reference`**, so
  running it twice leaves the row count unchanged (AC-1.5).
- Seed data covers every rendering case: tickets in P0, P1, P2, tickets with
  `priority = null`, tickets with `owner = null`, and at least one `CLOSED`
  ticket to prove the `status` filter works.
- `prisma/dev.db` and `.env` are git-ignored (NFR-6).

## Done when

Delete `prisma/dev.db`, run `pnpm db:reset`, and `GET /api/tickets` returns the
open subset.
