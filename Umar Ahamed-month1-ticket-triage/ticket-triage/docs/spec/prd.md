# Ticket Triage Tool — PRD

- **Owner:** Umar Ahamed (Intern, Engineering)
- **Sponsor:** Bistec Global PMO
- **Status:** Approved for Month 1 scaffold
- **Last updated:** 2026-08-30

> **Baseline note.** The numbers in §2 were taken from the six most recent PMO
> triage spreadsheets (2026-07-13 → 2026-08-17) and the seed extract in
> `prisma/seed/tickets.json`. They are the agreed working baseline for this
> exercise, not audited figures. Every target in §3 and §5 is re-measurable
> against those same two sources.

---

## 1. Persona

**Primary user — Nadeesha Perera, PMO Coordinator, Bistec Global (Colombo).**

- **Context.** Nadeesha sits in the delivery PMO and is accountable for the
  Monday 09:30 delivery-risk review. Six client squads (Apex, Keyflow,
  GreenChit, BookSwap, Ledger, Atlas) raise "delivery blocker" tickets to the
  PMO through three different doorways: a Teams channel post, an email to the
  PMO alias, and occasionally a row typed straight into her spreadsheet. She is
  not a developer; she lives in Excel, Teams and Outlook.
- **What she does with them.** Before the review she has to answer three
  questions for the delivery director: *what is on fire right now (P0)*,
  *who owns each item*, and *how many items are unowned*.
- **Pain point.** There is no single list. Nadeesha rebuilds the triage sheet by
  hand every Monday morning, copy-pasting from Teams and Outlook, and the sheet
  is stale the moment the review ends. Because priority and owner are free-text
  columns she types herself, they are the two fields most often left blank —
  and they are the only two the director actually asks about.

**Secondary user — Delivery Director.** Read-only consumer of the grouped view
during the review. Does not edit. Not a separate persona for Month 1; listed so
that "the read-only view must be legible without training" stays a design input.

**Explicitly not a user this month.** Squad engineers who *raise* tickets.
Intake stays in Teams/email (see NG-2).

---

## 2. Problem Statement

**What breaks today.**

| Observation | Measured baseline (6 weeks, 2026-07-13 → 2026-08-17) |
|---|---|
| Manual rebuild of the triage sheet each Monday | mean **41 min**, worst week 58 min |
| Open tickets with **no priority** at review time | **12%** (17 of 142 ticket-weeks) |
| Open tickets with **no owner** at review time | **19%** (27 of 142 ticket-weeks) |
| Weeks where at least one ticket was missed from the sheet entirely | **3 of 6** |
| Places a ticket can live before it reaches the sheet | **3** (Teams, email, direct sheet edit) |

**Who is affected.**

- Nadeesha loses ~41 min of her highest-pressure hour to copy-paste.
- The delivery director makes escalation calls on a list that is knowingly
  incomplete in 50% of weeks (3 of 6).
- Squad leads are re-asked for status they already reported, because the earlier
  report did not survive the copy-paste.

**Why now.** Squad count went from four to six in July 2026, and the two new
squads (Ledger, Atlas) account for 9 of the 17 unprioritised ticket-weeks above.
The manual process degrades roughly linearly with squad count, and a seventh
squad is scheduled for Q4 2026. The spreadsheet does not survive that.

**What "solved" looks like.** One URL that always shows every open ticket,
grouped by priority with counts, where setting priority and owner takes one
interaction each and persists. §3 sets the numeric bar.

---

## 3. Goals & Non-Goals

### Goals (measurable)

| ID | Goal | Metric | Baseline | Target |
|---|---|---|---|---|
| G-1 | Kill the manual Monday rebuild | Minutes of PMO prep before the 09:30 review | 41 min | **≤ 5 min** |
| G-2 | No blind spots in the priority column | % of open tickets with a priority at review time | 88% | **100%** |
| G-3 | No blind spots in the owner column | % of open tickets with an owner at review time | 81% | **100%** |
| G-4 | The grouped view *is* the review artefact | Priority groups + counts visible without scrolling at 1366×768 | n/a | **all four groups above the fold** |
| G-5 | The tool is never the reason the review is slow | Time to first render of `/tickets` on localhost | n/a | **≤ 1.5 s** (NFR-1) |

### Non-Goals (explicit exclusions for Month 1)

| ID | Non-Goal | Why excluded now |
|---|---|---|
| NG-1 | Authentication / SSO / per-user permissions | Runs on the internal network for a 6-person PMO. Auth would consume the whole Month 1 budget and blocks none of G-1..G-5. |
| NG-2 | Ticket **creation** in the app | Intake stays in Teams/email this month. Changing intake is a change-management problem, not a software one. |
| NG-3 | Notifications (email, Teams, push) | No goal above depends on push, and it invents a delivery-guarantee problem. |
| NG-4 | Two-way sync with Jira / ServiceNow / Azure Boards | Needs credentials and a field-mapping spec we do not have. Seed JSON is the Month 1 source. |
| NG-5 | Ticket close / reopen workflow | `status` is stored and filtered on, but transitions are out of scope; the PMO closes in the source system. |
| NG-6 | Attachments, comments, audit-history UI | `updatedAt` is persisted, but there is no history screen. The director has not asked for one. |
| NG-7 | Responsive layout below 1024px | The review happens on a laptop or a meeting-room screen. |
| NG-8 | Multi-tenant / multi-PMO | One PMO, one SQLite file. |

---

## 4. Functional Requirements

**Route note.** The dashboard is served at **`/tickets`**; the JSON API is served
at **`/api/tickets`** and **`/api/tickets/:id`**, because Next.js App Router
reserves `app/api/**` for route handlers. Wherever the brief says
`GET /tickets` / `PATCH /tickets/:id`, read it as that `/api` pair.

### FR-1 — List open tickets seeded from JSON

PMO staff can see every open ticket, loaded from `prisma/seed/tickets.json`.

- **AC-1.1** — **Given** the database has been seeded from `prisma/seed/tickets.json`,
  **When** a PMO user opens `/tickets`,
  **Then** every ticket with `status = "OPEN"` is rendered and no ticket with
  `status = "CLOSED"` is rendered.
- **AC-1.2** — **Given** a seeded database,
  **When** a client sends `GET /api/tickets`,
  **Then** the response is `200` with `Content-Type: application/json` and the
  body contains only `status = "OPEN"` tickets.
- **AC-1.3** — **Given** a seeded database,
  **When** a client sends `GET /api/tickets?status=CLOSED`,
  **Then** the response is `200` and contains only `status = "CLOSED"` tickets.
- **AC-1.4** — **Given** a client sends `GET /api/tickets?status=BANANA`,
  **When** the query is validated,
  **Then** the response is `400` with code `INVALID_QUERY` and no database read
  is performed.
- **AC-1.5** — **Given** the seed file contains a `reference` that already exists,
  **When** `pnpm db:seed` runs a second time,
  **Then** the seed upserts rather than duplicating and the ticket count is
  unchanged.

### FR-2 — Tag a ticket with a priority (P0 / P1 / P2)

- **AC-2.1** — **Given** an open ticket with `priority = null`,
  **When** a PMO user selects `P0` for that ticket in the dashboard,
  **Then** the priority is persisted as `P0` and the view re-renders with the
  ticket in the P0 group.
- **AC-2.2** — **Given** an existing ticket id,
  **When** a client sends `PATCH /api/tickets/:id` with `{"priority":"P1"}`,
  **Then** the response is `200` and the body is the updated ticket with
  `priority = "P1"`.
- **AC-2.3** — **Given** an existing ticket id,
  **When** a client sends `PATCH /api/tickets/:id` with `{"priority":"P9"}`,
  **Then** the response is `400`, the body names `priority` as the failing
  field, and the stored ticket is unchanged.
- **AC-2.4** — **Given** an existing ticket with `priority = "P0"`,
  **When** a client sends `PATCH /api/tickets/:id` with `{"priority":null}`,
  **Then** the response is `200` and the ticket returns to the Untriaged group.

### FR-3 — Assign an owner to a ticket

- **AC-3.1** — **Given** an open ticket with `owner = null`,
  **When** a PMO user types `Nadeesha Perera` into the owner field and commits it,
  **Then** the owner is persisted and displayed on the ticket.
- **AC-3.2** — **Given** an existing ticket id,
  **When** a client sends `PATCH /api/tickets/:id` with `{"owner":"  Ravi K.  "}`,
  **Then** the response is `200` and the stored owner is trimmed to `Ravi K.`.
- **AC-3.3** — **Given** an existing ticket id,
  **When** a client sends `PATCH /api/tickets/:id` with `{"owner":""}`,
  **Then** the response is `400`. An empty string is a mistake, not an
  un-assignment; un-assigning is `{"owner":null}`.
- **AC-3.4** — **Given** an existing ticket id,
  **When** a client sends `PATCH /api/tickets/:id` with an owner longer than 120
  characters,
  **Then** the response is `400` and the stored owner is unchanged.

### FR-4 — Group the dashboard by priority with count badges

- **AC-4.1** — **Given** a seeded database,
  **When** a PMO user opens `/tickets`,
  **Then** the page shows exactly four groups in this order — **P0, P1, P2,
  Untriaged** — each with a badge showing the number of tickets in that group.
- **AC-4.2** — **Given** a priority group with zero tickets,
  **When** the page renders,
  **Then** the group heading and a `0` badge are still shown with an empty-state
  line. A missing P0 heading is indistinguishable from a bug.
- **AC-4.3** — **Given** the four group badges,
  **When** their values are summed,
  **Then** the sum equals the total ticket count shown in the page header.
- **AC-4.4** — **Given** two tickets in the same priority group,
  **When** the group renders,
  **Then** tickets are ordered by `createdAt` ascending — oldest blocker first.

### FR-5 — Zod-validated JSON API

- **AC-5.1** — **Given** any request to `GET /api/tickets`,
  **When** the handler runs,
  **Then** the query string is parsed by a Zod schema *before* any database
  access, and the response body conforms to the same shared schema the dashboard
  consumes.
- **AC-5.2** — **Given** a `PATCH /api/tickets/:id` body containing a key that is
  not `priority`, `owner` or `status`,
  **Then** the response is `400`. The body schema is `.strict()`; unknown keys
  are rejected, not ignored.
- **AC-5.3** — **Given** a `PATCH /api/tickets/:id` request with body `{}`,
  **Then** the response is `400` with code `EMPTY_PATCH`. A patch that changes
  nothing is a client bug.
- **AC-5.4** — **Given** a `PATCH` for a ticket id that does not exist,
  **Then** the response is `404` with code `TICKET_NOT_FOUND`.
- **AC-5.5** — **Given** a `PATCH` whose body is not valid JSON,
  **Then** the response is `400` with code `INVALID_JSON` — never a 500.

---

## 5. Non-Functional Requirements

Every row is a number with a stated measurement method. No adjectives.

| ID | Category | Target | How it is measured |
|---|---|---|---|
| NFR-1 | Performance — page | `/tickets` first render **≤ 1500 ms** with the 24-ticket seed | `pnpm build && pnpm start`, cold localhost load, 3 runs, report the median |
| NFR-2 | Performance — API | `GET /api/tickets` **p95 ≤ 150 ms** and `PATCH /api/tickets/:id` **p95 ≤ 150 ms** | `pnpm bench` — 200 sequential requests each against a seeded DB on `next start`; p95 of measured latencies |
| NFR-3 | Type safety | **0** occurrences of the `any` type; `tsc --noEmit` exits 0 | `pnpm typecheck` plus ESLint `@typescript-eslint/no-explicit-any: "error"`; CI fails on either |
| NFR-4 | CI | End-to-end pipeline **< 180 s** | GitHub Actions duration of the `verify` job |
| NFR-5 | Security — input | **100%** of write paths validated by a Zod `.strict()` schema before reaching Prisma; **0** raw-SQL string interpolation | Route tests for unknown-key and malformed-JSON cases |
| NFR-6 | Security — exposure | **0** secrets in the repo; the SQLite file and `.env` are git-ignored | `.gitignore` review; CI defines no secrets |
| NFR-7 | Observability | **100%** of API responses emit one structured JSON log line with `requestId`, `method`, `path`, `status`, `durationMs`; every 5xx also carries `errorName` | `src/lib/logger.ts`, asserted in `tests/logger.test.ts` |
| NFR-8 | Error contract | **100%** of non-2xx API responses share the shape `{ error: { code, message, details? } }` | `ApiErrorSchema` in `src/lib/contracts.ts`, asserted in route tests |
| NFR-9 | Test gate | **≥ 1** passing Vitest test and a **100%** pass rate to merge | `pnpm test` in CI |
| NFR-10 | Process | **100%** of commits signed and in Conventional Commits form | `git log --show-signature`; README § Commit convention |

---

## 6. Data Model

Exactly these entities and fields. Anything not listed here must not appear in
`prisma/schema.prisma` — this section is the contract the schema is generated
against.

### Entity: `Ticket`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | String (cuid) | no | Primary key, generated |
| `reference` | String | no | Unique human key, e.g. `PMO-1042` — the value the PMO already quotes in Teams |
| `title` | String | no | One-line summary, ≤ 160 chars |
| `description` | String | no | Free text carried over from the intake message |
| `squad` | String | no | One of the six client squads; the director groups escalations by squad |
| `status` | String | no | `OPEN` / `TRIAGED` / `CLOSED`, default `OPEN` |
| `priority` | String | **yes** | `P0` / `P1` / `P2`; `null` means untriaged (the FR-4 "Untriaged" group) |
| `owner` | String | **yes** | Display name of the PMO or squad owner; `null` means unowned |
| `createdAt` | DateTime | no | Defaults to now; drives FR-4 ordering |
| `updatedAt` | DateTime | no | Auto-updated; the only audit signal in scope (NG-6) |

**Index:** `(status, priority)` — every dashboard read filters on `status` and
groups on `priority`.

**Why `priority` and `status` are `String` and not Prisma enums.** Prisma does
not support `enum` on the SQLite provider. Allowed values are enforced at the
boundary by Zod (`PrioritySchema`, `StatusSchema` in `src/lib/contracts.ts`), and
those same schemas produce the TypeScript union types — so type safety is
preserved even though the column is a string. See ADR-002.

**Why `owner` is a String and not an `Owner` relation.** NG-1 excludes auth and a
user directory, so there is nothing to relate to, and free text matches what the
spreadsheet holds today. Revisit when auth arrives.

---

## 7. Traceability

| FR | Stories | Speckit tasks | Code | Tests |
|---|---|---|---|---|
| FR-1 | S-001, S-003 | T2, T3, T5 | `prisma/schema.prisma`, `prisma/seed.ts`, `src/server/routes/tickets.ts` | `tests/routes.tickets.test.ts` |
| FR-2 | S-004 | T6, T8 | `src/server/routes/tickets.ts`, `src/app/tickets/ticket-row.tsx` | `tests/contracts.test.ts`, `tests/routes.tickets.test.ts` |
| FR-3 | S-004 | T6, T8 | as FR-2 | as FR-2 |
| FR-4 | S-005 | T7, T8 | `src/lib/grouping.ts`, `src/app/tickets/page.tsx` | `tests/grouping.test.ts` |
| FR-5 | S-002, S-006 | T4, T6 | `src/lib/contracts.ts`, `src/server/routes/tickets.ts` | `tests/contracts.test.ts`, `tests/routes.tickets.test.ts` |

---

## 8. Architecture Decision Records

Recorded one file each:

- [ADR-001 — Framework choice: Next.js 15 App Router](./adr-001-framework.md)
- [ADR-002 — Data layer: Prisma + SQLite](./adr-002-data-layer.md)
- [ADR-003 — Validation: Zod schemas as the single contract](./adr-003-validation.md)
