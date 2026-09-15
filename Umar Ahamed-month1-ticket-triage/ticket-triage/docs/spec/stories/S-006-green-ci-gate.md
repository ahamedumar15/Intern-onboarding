# S-006 — A CI gate that blocks a broken board from merging

- **FR:** FR-5 (indirectly) · **NFRs:** NFR-3, NFR-4, NFR-7, NFR-9, NFR-10 · **Tasks:** T9, T10

> **As** the engineer reviewing this intern's PR,
> **I want** lint, types, tests and build to run automatically in under 3 minutes,
> **so that** I review the design rather than hunting for a missing semicolon.

## Acceptance criteria

- `.github/workflows/ci.yml` runs on `pull_request` and on pushes to `main`.
- Four required checks, all blocking: `pnpm lint` (0 errors), `pnpm typecheck`
  (0 errors), `pnpm test` (100% pass, ≥ 1 test), `pnpm build` (exit 0).
- The pnpm store **and** `.next/cache` are cached — ADR-001 records that CI fails
  NFR-4 without both.
- `prisma generate` runs before typecheck, or `@prisma/client` types are missing
  and typecheck fails with a misleading error (ADR-002 consequence).
- End-to-end `verify` job duration < 180 s (NFR-4).
- Structured request logging is asserted by `tests/logger.test.ts` (NFR-7).
- Commits follow Conventional Commits and are signed (NFR-10).

## Notes

CI needs no database: the route tests use the in-memory fake repository, so
there is no migration step and no service container in the pipeline. `pnpm build`
does need a `DATABASE_URL` present, which the workflow sets inline — it is a
local file path, not a secret (NFR-6).

## Done when

All four checks are green on `main`.
