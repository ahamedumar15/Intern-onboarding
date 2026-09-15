# Ticket Triage — Bistec PMO

A single-page triage board for the Bistec Global PMO's Monday delivery-risk
review. Open delivery-blocker tickets are grouped by priority with count badges,
and each one can be given a priority and an owner in one interaction.

Every line of this repository was generated from the specs in [`docs/spec/`](docs/spec/)
by Claude Code, driven by the task plan in [`speckit.yaml`](speckit.yaml).

- **Dashboard:** `/tickets`
- **API:** `GET /api/tickets`, `PATCH /api/tickets/:id`

---

## Quick start

Prerequisites: **Node ≥ 20.11** and **pnpm 10** — `npm i -g pnpm@10.15.0`
(`corepack enable` also works if you have admin rights on Windows).

> **Do not downgrade to pnpm 9.** pnpm 9.15.x crashes on Node ≥ 22 while running
> dependency lifecycle scripts (`Error: readStream must be readable`). The
> version is pinned in `package.json` via `packageManager`, and pnpm re-executes
> whatever that field names — so changing it there is the only way to change it.

```bash
pnpm install                  # also runs `prisma generate` via postinstall
cp .env.example .env          # DATABASE_URL="file:./dev.db"
pnpm db:migrate               # creates prisma/dev.db from schema.prisma
pnpm db:seed                  # loads the 24 tickets in prisma/seed/tickets.json
pnpm dev                      # http://localhost:3000/tickets
```

`pnpm db:reset` re-runs the migration from scratch and re-seeds. The seed
**upserts on `reference`**, so running it twice does not duplicate rows (AC-1.5).

### Verifying it

```bash
pnpm lint        # ESLint, 0 errors required
pnpm typecheck   # tsc --noEmit, 0 errors required
pnpm test        # Vitest — no database needed
pnpm build       # next build
```

The same four commands are the CI gate in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). There is nothing CI runs
that you cannot run locally.

### Measuring the performance NFRs

```bash
pnpm build && pnpm start      # terminal 1
pnpm bench                    # terminal 2 — p95 for GET and PATCH (NFR-2)
```

`pnpm bench` exits non-zero if either p95 exceeds the 150 ms budget.

---

## Regenerating this repository from the spec

The specs are the source of truth; the code is the artefact. To rebuild the
whole scaffold from scratch in one Claude Code command:

```bash
claude "Read speckit.yaml and every file under docs/spec/. Execute tasks T1..T10 \
  in order. For each task, read ONLY the files listed in that task's `context` \
  key, write exactly the files in its `files` key, then run its `verify` command \
  and fix any failure before moving to the next task. Obey conventions.rules for \
  every task. Do not add fields, endpoints or dependencies that the PRD does not \
  name."
```

To regenerate a single layer instead of the whole thing, run one task's prompt.
For example, the data model:

```bash
claude "Read section 6 of docs/spec/prd.md and docs/spec/adr-002-data-layer.md. \
  Regenerate prisma/schema.prisma to match. Do not add fields that are not in \
  the PRD table. Do not use enum — the sqlite provider does not support it."
```

**Why each task names its own context.** Every task carries a `context` key
listing the only files the agent is allowed to read for it. T2 (the Prisma
schema) is scoped to PRD § 6 plus ADR-002 — 1,873 tokens instead of the 9,539 in
the full `docs/spec/` tree, an 80% reduction — because § 6 is the field list the
schema must match exactly, and the surrounding FR prose is the material most
likely to suggest fields that are not in that table. The measurements and the
failures this discipline was built from are in
`../Umar Ahamed-month1-context-notes.md`.

---

## Architecture

```
src/
├── app/                        Next.js App Router — the ONLY place next/* is imported
│   ├── tickets/page.tsx        Server Component: calls the repository directly
│   ├── tickets/ticket-row.tsx  the one Client Component (priority + owner editors)
│   └── api/tickets/**          4-line adapters that delegate to src/server
├── lib/
│   ├── contracts.ts            Zod schemas — the single source of truth (ADR-003)
│   ├── grouping.ts             pure FR-4 grouping
│   ├── logger.ts               one structured JSON line per response (NFR-7)
│   └── db.ts                   Prisma client singleton
└── server/
    ├── routes/tickets.ts       Request → Response. Framework-agnostic.
    └── repository/             TicketRepository interface + the Prisma impl
```

Three seams are load-bearing, and all three are enforced rather than documented:

1. **`src/server` and `src/lib` must not import `next/*`** (ADR-001). An ESLint
   `no-restricted-imports` rule fails the build if they do. That is why the route
   handlers are testable in plain Vitest with no Next.js harness.
2. **Route handlers depend on the `TicketRepository` interface, never on Prisma**
   (ADR-002). The tests inject an in-memory fake, so `pnpm test` needs no
   database, no migration and no service container — which is what keeps CI
   inside NFR-4's 180 s.
3. **Every value crossing the HTTP boundary is parsed by a schema in
   `contracts.ts`** (ADR-003). SQLite cannot enforce the `P0/P1/P2` enum
   (ADR-002 § Consequences), so this is the *only* thing preventing
   `priority = "P9"` from being persisted. All Prisma writes are confined to
   `prisma-ticket-repository.ts` so that claim stays checkable.

### API

| Method | Path | Success | Failure codes |
|---|---|---|---|
| `GET` | `/api/tickets?status=OPEN\|TRIAGED\|CLOSED` | `200` `{ status, total, groups[] }` | `400 INVALID_QUERY`, `500 INTERNAL_ERROR` |
| `PATCH` | `/api/tickets/:id` | `200` the updated ticket | `400 INVALID_JSON`, `400 INVALID_BODY`, `400 EMPTY_PATCH`, `404 TICKET_NOT_FOUND`, `500 INTERNAL_ERROR` |

`PATCH` accepts any non-empty subset of `{ priority, owner, status }`. The body
schema is `.strict()` — an unknown key is a `400`, never a silent no-op.

Every non-2xx response has the same envelope (NFR-8):

```json
{ "error": { "code": "INVALID_BODY", "message": "Request body failed validation.",
             "details": [{ "path": "priority", "message": "Invalid enum value..." }] } }
```

Two deliberate distinctions worth knowing before you call it:

- `{"owner": null}` **un-assigns**. `{"owner": ""}` is a **400** — an empty
  string is almost always a UI bug, and treating it as an un-assign would let
  the tool quietly wipe an owner.
- `{"priority": null}` returns a ticket to the **Untriaged** group; it is a
  valid state, not an error.

```bash
curl localhost:3000/api/tickets | jq '.groups[] | {key, count}'
curl -X PATCH localhost:3000/api/tickets/<id> \
  -H 'content-type: application/json' -d '{"priority":"P0","owner":"Nadeesha Perera"}'
```

---

## Spec artefacts

| File | What it fixes |
|---|---|
| [`docs/spec/prd.md`](docs/spec/prd.md) | Persona, measured problem baseline, FR-1..FR-5 with Given/When/Then, numeric NFRs, and § 6 — the data model the Prisma schema is generated against |
| [`docs/spec/adr-001-framework.md`](docs/spec/adr-001-framework.md) | Next.js 15 App Router, and the three alternatives that lost |
| [`docs/spec/adr-002-data-layer.md`](docs/spec/adr-002-data-layer.md) | Prisma + SQLite, and the enum hole it accepts |
| [`docs/spec/adr-003-validation.md`](docs/spec/adr-003-validation.md) | Zod as the single contract — the decision that patches ADR-002's hole |
| [`docs/spec/stories/`](docs/spec/stories/) | S-001..S-006, each tracing to FRs and speckit tasks |
| [`speckit.yaml`](speckit.yaml) | T1..T10, each ≤ 30 minutes, with its own context allow-list and verify command |

PRD § 7 carries the full FR → story → task → code → test traceability table.

---

## Known limitations

Honest list, so nobody discovers these in a demo:

- **No authentication** (NG-1). Anyone who can reach the URL can re-prioritise
  the board. Acceptable on an internal network for a 6-person PMO; not
  acceptable the moment this is exposed more widely.
- **No ticket creation** (NG-2). Intake stays in Teams/email; the board is
  populated by re-running the seed.
- **SQLite has one writer** (ADR-002). Fine at PMO scale, a hard blocker for
  multi-squad self-service.
- **The database will accept an invalid priority** if a future write path skips
  `UpdateTicketSchema` (ADR-003). A `CHECK` constraint is the Month 2 fix.
- **Desktop only** (NG-7). No layout work below 1024px.
- **`status` transitions are not modelled** (NG-5). The column is stored and
  filtered on; closing still happens in the source system.

---

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/), signed (NFR-10):

```bash
git commit -S -m "feat(api): add PATCH /api/tickets/:id with Zod validation"
```

Scopes in use: `spec`, `db`, `api`, `ui`, `ci`, `test`, `docs`.
