# ADR-001 — Framework choice: Next.js 15 App Router

- **Status:** Accepted
- **Date:** 2026-08-30
- **Deciders:** Umar Ahamed (Intern), PMO sponsor
- **Relates to:** FR-1, FR-4, FR-5, NFR-1, NFR-4

## Context

The PMO triage tool needs two surfaces that must not drift apart:

1. A server-rendered dashboard at `/tickets` that must reach first render in
   **≤ 1500 ms** on localhost (NFR-1, G-5).
2. A JSON API (`GET /api/tickets`, `PATCH /api/tickets/:id`) that shares its
   validation schema and its TypeScript types with that dashboard (FR-5, NFR-3).

Additional forces:

- **One intern, three hours, no manual code.** Every extra moving part is a part
  the agent has to be told about and the CI has to install.
- **NFR-4 caps CI at 180 s.** Two build pipelines would roughly double install
  and build time.
- **NFR-3 demands zero `any`.** A hand-rolled fetch layer between a separate SPA
  and a separate API is exactly where `any` normally leaks in, because the
  response type has to be re-asserted on the client.
- Bistec's existing internal tools (GreenChit, Apex) are already Next.js, so a
  reviewer inside the company can read this repo without a context switch.

## Decision

Use **Next.js 15 with the App Router**, one deployable unit, with:

- React Server Components for the dashboard page, so the ticket list is fetched
  in-process (a direct repository call, **not** an HTTP self-fetch) and arrives
  in the first HTML payload.
- Route Handlers under `src/app/api/**` as thin adapters that delegate to
  framework-agnostic handlers in `src/server/routes/tickets.ts`.
- A single `src/lib/contracts.ts` of Zod schemas imported by both surfaces.

The business logic deliberately does **not** import anything from `next/*`. The
route handlers take a `Request` and return a `Response` — Web-standard types —
so the logic is testable in plain Vitest with no Next.js test harness, and a
future move off Next.js touches only the four files under `src/app/api/`.

## Alternatives considered

### A. Vite + React SPA and a separate Express API — **rejected**

- Two build pipelines, two dependency trees, two things to cache in CI. The
  install-and-build budget alone puts NFR-4 (< 180 s) at risk.
- Client-side data fetching means the ticket list renders only after
  hydrate → fetch → paint. Against a cold local server that is the single most
  likely way to miss NFR-1's 1500 ms.
- The typed boundary between SPA and API has to be maintained by hand, which is
  the usual source of the `any` casts NFR-3 forbids.
- *What would change our mind:* if the PMO ever needs the dashboard embedded in
  a non-Node host, a standalone API becomes worth the cost.

### B. Remix / React Router 7 — **rejected, but close**

- Genuinely meets NFR-1 (server rendering) and NFR-3 (typed loaders) as well as
  Next.js does. This was the strongest alternative.
- Rejected on organisational fit rather than technical merit: no other Bistec
  internal tool uses it, so the intern reviewing this in Month 2 pays a learning
  cost that buys nothing measurable against G-1..G-5.

### C. Plain Express + a template engine (EJS/Pug) — **rejected**

- Fastest possible first paint and the smallest dependency tree — genuinely
  competitive on NFR-1.
- Rejected because FR-2/FR-3 need per-row interactive editing that persists
  without a full page reload. Doing that without a component framework means
  hand-written DOM code, which is precisely the "no manual edits" constraint's
  worst case, and template output is not type-checked, so NFR-3 loses its teeth
  in the view layer.

### D. Next.js 15 **Pages** Router — **rejected**

- Familiar and stable, but `getServerSideProps` serialises props through JSON,
  so `Date` fields arrive as strings and need re-parsing — extra mapping code
  and another place for `any` to appear. The App Router lets the page call the
  repository directly.

## Consequences

**Positive**

- One `pnpm install`, one `pnpm build`, one cache key in CI — the cheapest path
  to NFR-4.
- Dashboard and API share `src/lib/contracts.ts`, so a schema change breaks the
  build on both sides at once. This is the main mechanism enforcing NFR-3.
- Server Components mean the ticket rows are in the initial HTML; NFR-1 has
  headroom rather than depending on hydration speed.

**Negative / accepted costs**

- Next.js is a large dependency (~350 MB of `node_modules`). CI **must** cache
  the pnpm store and `.next/cache`, or NFR-4 fails. This is a hard requirement
  on `.github/workflows/ci.yml`, not a nice-to-have.
- App Router caching defaults are aggressive. The `/tickets` page must set
  `export const dynamic = "force-dynamic"`, otherwise it is statically rendered
  at build time and a PATCH appears to do nothing — a stale board is worse than
  a slow one for the Monday review.
- React Server Components are a genuine learning curve for the next person; the
  server/client split is documented in `README.md` § Architecture to blunt it.
- Coupling to a Vercel-stewarded framework. Mitigated by keeping
  `src/server/**` free of `next/*` imports (see Decision).

## Verification

- NFR-1 measured after `pnpm build && pnpm start` — result recorded in the CI
  report.
- The no-`next/*`-in-`src/server` rule is enforced by an ESLint
  `no-restricted-imports` rule, so the escape hatch closes automatically.
