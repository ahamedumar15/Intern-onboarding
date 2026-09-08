# Ticket Triage Tool — PRD

**Author:** Umar Ahamed\
**Date:** 2026-08-31\
**Status:** Draft for review (Month 1 challenge, Deliverable 1)\
**Repo path:** `/docs/spec/`

> **Baseline note.** The quantities in §2 are the PMO's current working numbers as stated in the challenge brief plus a measured baseline taken from two weeks of the existing triage spreadsheet. Any figure marked *(assumed)* has not yet been confirmed by the PMO lead and must be validated before we treat it as a success metric.

---

## 1. Persona

### Primary user — Nadeesha, PMO Coordinator, Delivery Operations (Bistec Global, Colombo)

| Attribute | Detail |
|---|---|
| Role | PMO Coordinator sitting in the Delivery Operations function |
| Reports to | Head of PMO |
| Tenure | 3 years at Bistec; owns delivery reporting for 6 active client engagements |
| Tools today | Outlook, Microsoft Teams, a shared `Triage.xlsx` on SharePoint, Jira (read-only access on two client projects) |
| Technical level | Power user of Excel; not a developer; will not run `npm` commands |

**Context.** Every Monday at 09:00 Nadeesha runs the delivery triage stand-up with six Delivery Leads. Before that meeting she has to collect the escalations raised the previous week — they arrive as Teams messages, forwarded client emails, and ad-hoc Jira tickets on the two engagements where Bistec has a client Jira licence — and consolidate them into one spreadsheet, assign a priority, and name an owner for each.

**Pain point.** The consolidation is manual and the spreadsheet is the only source of truth. Nadeesha cannot answer "how many P0s are open right now and who owns them?" without re-reading the sheet row by row. Priority is recorded as free text (`Critical`, `critical`, `P0`, `Urgent!!`), so the counts she reports to the Head of PMO are inconsistent week to week and cannot be trusted for trend reporting.

**What success feels like to her.** She opens one page, sees open tickets grouped under P0/P1/P2 with a count on each group, sets priority and owner from a dropdown, and the numbers she quotes in the stand-up are the numbers on the screen.

### Secondary users (in scope for read, not for this milestone's workflows)

- **Delivery Lead** — opens the dashboard to see the tickets assigned to them before the stand-up.
- **Head of PMO** — reads the priority counts; does not edit tickets.

---

## 2. Problem Statement

**What breaks today.**

1. Triage inputs are spread across three systems (Teams, Outlook, Jira) and one spreadsheet, with no single list of open tickets.
2. Priority is unvalidated free text. In the last two weeks' sheet, 41 open rows used **7 distinct spellings** of three intended priority levels, so `COUNTIF` on priority is wrong by construction.
3. Ownership is recorded as a typed name, not a controlled value. 9 of 41 open rows (22%) had a blank or ambiguous owner ("Delivery team").

**Who is affected.**

- Nadeesha (1 PMO Coordinator) — spends **~75 minutes** every Monday morning consolidating and re-keying, measured across two runs *(assumed to be representative)*.
- 6 Delivery Leads — each loses stand-up time re-establishing which items are actually theirs.
- Head of PMO — receives priority counts that cannot be compared week over week.

**Cost, quantified.** ~75 min/week of coordinator time (≈65 hrs/year) plus ~5 min × 6 leads × 52 weeks (≈26 hrs/year) of stand-up time, against a triage volume of **40–60 open tickets** at any time.

**Why now.** Two additional client engagements onboard in Q4, taking the steady-state open-ticket count to an estimated 80–100. The spreadsheet process already fails at 41 rows; it will not survive doubling. This milestone also serves as the reference implementation for the spec-first BMAD / Speckit / Claude Code workflow the delivery teams are being asked to adopt.

**Measurable definition of "solved" (target, 30 days after rollout):**

| Metric | Baseline | Target |
|---|---|---|
| Monday consolidation time | 75 min | ≤ 20 min |
| Distinct priority values in the dataset | 7 | exactly 3 (`P0`, `P1`, `P2`) |
| Open tickets with no owner | 22% | ≤ 5% |
| Time to answer "how many open P0s?" | manual scan, ~3 min | ≤ 5 s (visible on page load) |

---

## 3. Goals & Non-Goals

### Goals (measurable)

| ID | Goal | Measure of success |
|---|---|---|
| G-1 | One dashboard listing every open ticket | 100% of seed tickets with a non-closed status render on `/` |
| G-2 | Priority becomes a controlled value | Only `P0` \| `P1` \| `P2` are accepted; invalid input rejected with HTTP 400 |
| G-3 | Ownership is explicit | Owner is settable in ≤ 2 clicks; unowned tickets are visually flagged |
| G-4 | Counts are trustworthy at a glance | Each priority group shows a badge count equal to the number of rows in that group |
| G-5 | The scaffold is CI-verified | Lint + build + smoke test pass on every PR in under 3 minutes |
| G-6 | The spec drives the code | Every FR below traces to a story in `/docs/spec/stories/` and to a test |

### Non-Goals (explicit exclusions for this milestone)

| ID | Non-goal | Why excluded |
|---|---|---|
| NG-1 | Authentication / SSO / RBAC | Localhost scaffold only; Entra ID integration is a separate milestone with its own ADR |
| NG-2 | Live Jira / Teams / Outlook ingestion | Seed JSON is the agreed input for Month 1; connectors depend on client-side licensing decisions |
| NG-3 | Creating or deleting tickets | Triage is a *classification* workflow; ticket creation stays in the source systems |
| NG-4 | Comments, attachments, activity history | Not required to answer "what is open, how urgent, who owns it" |
| NG-5 | Email / Teams notifications | No delivery channel is owned by this app in Month 1 |
| NG-6 | Multi-tenant or per-client data isolation | Single PMO instance; revisit if the tool is offered to client PMOs |
| NG-7 | Production hosting, backups, DR | SQLite file on localhost; a hosting ADR is required before any deployment beyond the scaffold |
| NG-8 | Mobile-optimised layout | Desktop browser at ≥ 1280 px is the only supported viewport |

---

## 4. Functional Requirements

Priority values are exactly `P0`, `P1`, `P2`. A ticket is *open* when `status != "CLOSED"`.

### FR-1 — List open tickets from the JSON seed

The dashboard lists every open ticket seeded from `prisma/seed/tickets.json`, showing id, title, status, priority and owner.

**AC-1.1**
> **Given** the database has been seeded from `tickets.json` with 50 tickets, 45 of which are open
> **When** Nadeesha opens `http://localhost:3000/`
> **Then** exactly 45 ticket rows are rendered, and each row shows id, title, status, priority and owner (or the placeholder `Unassigned`)

**AC-1.2**
> **Given** the seed contains a ticket with `status = "CLOSED"`
> **When** the dashboard renders
> **Then** that ticket is not present in any priority group

**AC-1.3**
> **Given** the database contains no open tickets
> **When** the dashboard renders
> **Then** an empty state reading "No open tickets" is shown instead of empty group containers, and the page returns HTTP 200

---

### FR-2 — Tag a ticket with a priority

Any ticket can be assigned a priority of `P0`, `P1` or `P2` from the dashboard.

**AC-2.1**
> **Given** an open ticket currently at `P2`
> **When** Nadeesha selects `P0` from that ticket's priority control
> **Then** the change is persisted via `PATCH /tickets/:id`, the ticket moves into the P0 group, and both affected group badges update without a full page reload

**AC-2.2**
> **Given** a client sends `PATCH /tickets/42` with body `{ "priority": "URGENT" }`
> **When** the request is validated by the Zod schema
> **Then** the API responds `400` with a body of shape `{ error: { field: "priority", message: string } }` and the stored record is unchanged

**AC-2.3**
> **Given** the PATCH request fails (non-2xx or network error)
> **When** the response is received
> **Then** the row reverts to its previous priority and an inline error message is shown

---

### FR-3 — Assign an owner to a ticket

Any ticket can be assigned an owner from the list of Delivery Leads.

**AC-3.1**
> **Given** an open ticket with `owner = null`
> **When** Nadeesha selects a Delivery Lead from the owner control
> **Then** the owner is persisted via `PATCH /tickets/:id` and the row shows that owner's name in place of `Unassigned`

**AC-3.2**
> **Given** a ticket with an assigned owner
> **When** Nadeesha clears the owner
> **Then** `PATCH /tickets/:id` is sent with `{ "owner": null }`, the request succeeds, and the row shows `Unassigned` with the unowned visual flag

**AC-3.3**
> **Given** a client sends `PATCH /tickets/42` with body `{ "owner": "" }`
> **When** the request is validated
> **Then** the API responds `400` (an empty string is not a valid owner; `null` is the way to clear ownership)

---

### FR-4 — Group tickets by priority with count badges

The dashboard groups open tickets into three sections — P0, P1, P2 — each with a count badge.

**AC-4.1**
> **Given** 45 open tickets comprising 4 × P0, 16 × P1 and 25 × P2
> **When** the dashboard renders
> **Then** three groups appear in the order P0, P1, P2 with badges reading `4`, `16` and `25`, and the badge total equals the number of rendered rows

**AC-4.2**
> **Given** no open ticket currently has priority `P0`
> **When** the dashboard renders
> **Then** the P0 group is still rendered with a badge of `0` (so an empty P0 queue is an explicit, visible statement)

**AC-4.3**
> **Given** a ticket's priority is changed from `P1` to `P0`
> **When** the update succeeds
> **Then** the P0 badge increments by 1 and the P1 badge decrements by 1 within the same render pass

---

### FR-5 — API: `GET /tickets` and `PATCH /tickets/:id` with Zod-validated input

The dashboard is backed by a typed JSON API whose request and response payloads are validated by Zod schemas that are the single source of the TypeScript types.

**AC-5.1**
> **Given** the seeded database
> **When** a client sends `GET /tickets`
> **Then** the API responds `200` with `{ tickets: Ticket[] }`, where every element parses against `TicketSchema` and `priority` is one of `P0` \| `P1` \| `P2`

**AC-5.2**
> **Given** the seeded database
> **When** a client sends `GET /tickets?priority=P0`
> **Then** the API responds `200` and every returned ticket has `priority === "P0"`; an unrecognised query value responds `400`

**AC-5.3**
> **Given** a valid body `{ "priority": "P1", "owner": "Ruwan Silva" }`
> **When** a client sends `PATCH /tickets/7`
> **Then** the API responds `200` with the full updated ticket and the change is durable across a server restart

**AC-5.4**
> **Given** a request for a ticket id that does not exist
> **When** a client sends `PATCH /tickets/9999`
> **Then** the API responds `404` with `{ error: { message: "Ticket not found" } }`

**AC-5.5**
> **Given** a body containing unknown keys, e.g. `{ "priority": "P1", "isAdmin": true }`
> **When** the schema parses the body in `strict` mode
> **Then** the API responds `400` and no unknown key is written to the database

---

### Traceability

| FR | Goal | Story | Primary test |
|---|---|---|---|
| FR-1 | G-1 | `story-01-list-tickets.md` | render test on `/` with seeded fixture |
| FR-2 | G-2 | `story-02-set-priority.md` | Zod unit test + `PATCH` route test |
| FR-3 | G-3 | `story-03-assign-owner.md` | `PATCH` route test (set / clear) |
| FR-4 | G-4 | `story-04-group-and-count.md` | badge-count render test |
| FR-5 | G-2, G-5 | `story-05-api-contract.md` | CI smoke test against `GET /tickets` |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Threshold | How it is measured |
|---|---|---|---|
| NFR-P1 | Initial dashboard render on localhost | Largest Contentful Paint ≤ **1.5 s** | Lighthouse (desktop preset) against `next build && next start`, seeded with 50 tickets, median of 3 runs |
| NFR-P2 | `GET /tickets` latency with seed data | **p95 ≤ 150 ms** | `autocannon -c 10 -d 20` on localhost, seeded dataset |
| NFR-P3 | `PATCH /tickets/:id` latency | **p95 ≤ 150 ms** | same harness, 20 s write mix |
| NFR-P4 | Dataset scale supported at the above thresholds | **≥ 200 tickets** (2× the projected Q4 volume of 80–100) | thresholds re-measured against a 200-row seed |
| NFR-P5 | Client JS shipped for `/` | **≤ 120 kB gzipped** first-load JS | `next build` route report, asserted in CI |

### 5.2 Type safety & code quality

| ID | Requirement | Threshold |
|---|---|---|
| NFR-Q1 | Zero `any` types | `tsc --noEmit` under `"strict": true` → **0 errors**; ESLint `@typescript-eslint/no-explicit-any` **and** `no-unsafe-*` set to `error` → **0 violations**; count of `// @ts-expect-error` and `eslint-disable` comments = **0** |
| NFR-Q2 | Runtime types derive from schemas | 100% of API request/response types are `z.infer<>` of a Zod schema — no hand-written duplicate interface |
| NFR-Q3 | Test coverage on API route handlers and grouping logic | **≥ 80%** lines |
| NFR-Q4 | Lint | ESLint → **0 errors, 0 warnings** (`--max-warnings=0`) |

### 5.3 CI / delivery

| ID | Requirement | Threshold |
|---|---|---|
| NFR-C1 | Pipeline duration | lint + build + smoke test complete in **< 3 min** end to end (p95 over the last 10 runs) |
| NFR-C2 | Commit hygiene | **100%** of commits GPG-signed (`Verified` on GitHub) and matching Conventional Commits — enforced by commitlint in CI |
| NFR-C3 | CI provider | GitHub Actions only; **0** external CI providers configured |
| NFR-C4 | Merge gate | **0** merges to `main` with a red required check |
| NFR-C5 | Smoke test | CI boots the app, asserts `GET /tickets` returns `200` with ≥ 1 ticket, within a **60 s** timeout |

### 5.4 Security

| ID | Requirement | Threshold |
|---|---|---|
| NFR-S1 | Input validation | **100%** of write endpoints parse their body with a `strict` Zod schema before touching Prisma; unknown keys rejected |
| NFR-S2 | Injection safety | **0** raw SQL string interpolation; all queries via Prisma Client |
| NFR-S3 | Dependency vulnerabilities | **0** high or critical findings from `npm audit --audit-level=high` in CI |
| NFR-S4 | Secrets | **0** secrets in the repo (gitleaks scan in CI); `dev.db` and `.env*` git-ignored |
| NFR-S5 | Error responses | **0** stack traces or Prisma error text returned to the client; the response shape is `{ error: { message } }` |

> Note: authentication is deliberately out of scope (NG-1), so the Month 1 scaffold **must not be exposed beyond localhost**. This is recorded as an accepted risk, not an oversight.

### 5.5 Observability

| ID | Requirement | Threshold |
|---|---|---|
| NFR-O1 | Request logging | **100%** of API requests emit one structured JSON line: `{ ts, method, path, status, durationMs, ticketId? }` |
| NFR-O2 | Error logging | **100%** of 5xx responses log a correlation `requestId` that is also returned in the response body |
| NFR-O3 | Latency visibility | `durationMs` present on every request log line, so p95 can be derived without extra tooling |
| NFR-O4 | Health endpoint | `GET /api/health` returns `200` with `{ status, dbOk, seedCount }` in **≤ 50 ms** |

### 5.6 Accessibility & usability

| ID | Requirement | Threshold |
|---|---|---|
| NFR-A1 | Automated accessibility | Lighthouse accessibility score **≥ 90**; **0** `axe` critical violations on `/` |
| NFR-A2 | Keyboard operability | Priority and owner controls fully operable by keyboard; **0** focus traps |
| NFR-A3 | Colour independence | Priority is conveyed by a text label as well as colour (contrast ≥ 4.5:1) |
| NFR-A4 | Supported viewport | Renders without horizontal scroll at **1280 × 800** |

---

## 6. Architecture Decision Records

### ADR-001 — Use Next.js 15 (App Router) for both UI and API

**Status:** Accepted — 2026-08-31

**Context**

- The deliverable is a single, small internal dashboard (one page, two endpoints) that must reach a working, CI-verified scaffold inside a 3-hour session.
- FR-5 requires a JSON API; FR-1 / FR-4 require server-rendered data with an initial render budget of 1.5 s (NFR-P1) and a first-load JS budget of 120 kB (NFR-P5).
- The team constraint fixes the stack at Next.js 15 App Router + TypeScript strict + Tailwind; the decision to record is *how* we use it — specifically, whether the API lives inside the same Next.js app or in a separate service.
- The codebase is generated by Claude Code from these specs, so a single project with one build, one lint config and one test runner materially reduces the surface the generator has to get right.

**Decision**

- Ship one Next.js 15 App Router application containing both the dashboard and the API.
- The dashboard route is a **React Server Component** that reads tickets directly through Prisma at render time — no client-side fetch on first paint.
- `GET /tickets` and `PATCH /tickets/:id` are implemented as Route Handlers under `app/api/tickets/`, and are the contract consumed by the client-side mutations in FR-2 and FR-3.
- Client Components are used only for the interactive priority / owner controls, keeping first-load JS inside NFR-P5.

**Consequences**

*Easier:* one repo, one `npm run build`, one CI job — supports NFR-C1's 3-minute budget. Server-rendered first paint removes a client round-trip from the NFR-P1 path. Types are shared between server and client without a published package.

*Harder:* server/client boundaries are a genuine source of bugs (a Prisma import leaking into a Client Component breaks the build), so the boundary must be asserted in review. Coupling UI and API deployment means the API cannot be scaled or released independently.

*Different:* the API is a byproduct of the app rather than a standalone product; if a second consumer ever appears, ADR-001 should be revisited rather than stretched.

**Alternatives considered**

- **Vite + React SPA with a separate Express API — rejected.** Two projects, two build pipelines and two lint configs roughly double the CI surface against a 3-minute budget, and a client-only first paint puts the 1.5 s LCP target at risk with no server render. It also contradicts the stated stack constraint.
- **Remix — rejected.** Its loader/action model fits this workload well, but it is off the mandated stack and the team has no Remix experience to draw on during review.
- **Next.js Pages Router — rejected.** Would work, but forgoes Server Components (costing us the zero-fetch first paint) and is the legacy path for new Next.js 15 work.
- **Next.js Server Actions instead of Route Handlers — rejected for this milestone.** Ergonomically pleasant, but FR-5 explicitly requires an inspectable HTTP contract (`GET /tickets`, `PATCH /tickets/:id`) that CI can smoke-test (NFR-C5); Server Actions do not give us a stable, curl-able endpoint.

---

### ADR-002 — Use Prisma ORM over SQLite for the data layer

**Status:** Accepted — 2026-08-31

**Context**

- Data is a single `Ticket` entity seeded from `tickets.json`; the only writes are priority and owner updates (FR-2, FR-3). Volume is 40–60 open tickets now, 80–100 projected, with NFR-P4 asking for headroom to 200.
- NFR-Q1 forbids `any` and NFR-Q2 requires types to be generated rather than hand-written, so a client that emits TypeScript types from the schema is worth a lot here.
- NFR-C1 caps CI at 3 minutes and the app must run on a developer laptop with no Docker dependency.
- NFR-S2 forbids raw SQL string interpolation.
- The stack constraint names Prisma + SQLite; the substance of this decision is treating the JSON file as a **seed**, not as the system of record.

**Decision**

- Model `Ticket` in `prisma/schema.prisma` with `priority` and `status` as enums, so the three-value priority constraint (G-2) is enforced in the database as well as at the API boundary.
- Use SQLite (`file:./dev.db`) as the datasource, created by `prisma migrate dev` and populated by `prisma/seed.ts` reading `tickets.json`.
- Access data exclusively through generated Prisma Client — no raw SQL.
- `dev.db` is git-ignored and disposable; `tickets.json` plus the migration history are the reproducible source of truth, and CI rebuilds the database from them on every run.

**Consequences**

*Easier:* generated types flow from schema to API to UI, which is the cheapest route to NFR-Q1 / Q2. No database server means `npm install && npm run db:reset && npm run dev` is the entire setup, and CI needs no service container — protecting NFR-C1. SQLite's local file access comfortably meets the 150 ms p95 target at this data volume.

*Harder:* SQLite serialises writes and has no meaningful concurrency story, so this choice does not survive a multi-user deployment. Prisma adds a `prisma generate` step to the build and a client bundle to `node_modules`. Enum changes require a migration rather than a code edit.

*Different:* the JSON seed becomes an input artefact rather than the live store, which means edits made in the UI are lost on `db:reset` — acceptable and intended for a scaffold, and a trap if anyone treats this instance as real data.

**Alternatives considered**

- **Read and write `tickets.json` directly, no database — rejected.** Superficially the simplest option and it satisfies FR-1, but concurrent writes corrupt the file, there is no schema enforcement behind the API (weakening G-2 and NFR-S1), and it produces no migration path to a real database. It would have to be thrown away at the first sign of a second user.
- **`better-sqlite3` with hand-written SQL — rejected.** Fastest raw path and no ORM in the bundle, but every row would need a hand-written mapping to a TypeScript type, which is exactly the hand-maintained-types risk NFR-Q2 exists to remove, and it puts string-built SQL in the codebase against NFR-S2.
- **PostgreSQL in Docker — rejected for this milestone.** The right answer for a shared, multi-user deployment, but it adds a container to local setup and a service to every CI run for no benefit at 200 rows. Prisma keeps the migration cheap — switching the datasource provider and re-running migrations is the bulk of the change — and it will be its own ADR when hosting is decided (NG-7).
- **Drizzle ORM — rejected.** Comparable type-safety story with a lighter runtime, but off the mandated stack and less familiar to reviewers; the difference does not pay for itself at this size.

---

### ADR-003 — Zod schemas are the single source of truth for API types

**Status:** Accepted — 2026-08-31

**Context**

- FR-5 requires Zod-validated input; NFR-Q1 requires zero `any`; NFR-Q2 requires that no API type is hand-written twice.
- Prisma generates types for what is *in the database*, but not for what arrives *over the wire* — an untrusted `PATCH` body is `unknown` until something proves otherwise, and that gap is where `any` normally creeps in.
- AC-5.5 requires unknown keys to be rejected rather than silently ignored, so validation must be strict, not permissive.

**Decision**

- Define `TicketSchema`, `PatchTicketSchema` and `TicketQuerySchema` in `lib/schemas.ts`; derive every TypeScript type via `z.infer<>`.
- Every route handler parses params, query and body with `safeParse` before any Prisma call; a parse failure maps to a `400` with `{ error: { field, message } }`.
- Object schemas use `.strict()` so unknown keys fail (AC-5.5).
- The same schemas are imported by the client components, so form input is validated against the identical definition.

**Consequences**

*Easier:* one definition covers runtime validation and compile-time types, closing the `unknown → any` gap that NFR-Q1 targets. Error responses are uniform, which makes the FR-2 / FR-3 rollback behaviour easy to implement and test.

*Harder:* the Zod enum and the Prisma enum both describe priority and can drift; a unit test asserts they stay identical. Strict parsing means additive client changes fail loudly until the schema is updated — intended, but it must be understood.

*Different:* the API contract lives in code rather than in a separate OpenAPI document; if a published contract is needed later, it should be generated from these schemas rather than maintained alongside them.

**Alternatives considered**

- **TypeScript interfaces plus manual `if` checks — rejected.** Interfaces vanish at runtime, so the checks and the types drift apart, and the first missed branch reintroduces the exact class of bug (`"URGENT"` reaching the database) that G-2 exists to prevent.
- **Casting the parsed body (`body as PatchTicket`) — rejected.** A cast is an assertion with no verification; it satisfies the compiler while leaving the runtime unprotected, and it is the most common way `any`-equivalent unsafety enters a "strict" codebase.
- **Relying on Prisma's runtime validation alone — rejected.** Prisma rejects a bad enum value, but the failure surfaces as a database-layer error, which contradicts NFR-S5 (no Prisma error text to the client) and gives a worse message than a field-level 400.





