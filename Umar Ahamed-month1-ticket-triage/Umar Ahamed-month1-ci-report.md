# CI Report — Month 1

**Umar Ahamed · Ticket Triage Tool · 2026-08-30**

> ### Scope of this report — read first
>
> Every number below was **measured locally** and is reproducible with the
> commands quoted beside it. The GitHub Actions workflow
> ([`.github/workflows/ci.yml`](ticket-triage/.github/workflows/ci.yml)) is
> written and committed, but **it has not yet executed on GitHub**: this
> environment's Git is read-only by policy, so nothing was pushed, and the `gh`
> CLI is not installed. There is therefore **no green-check screenshot and no
> Actions run URL** in this report.
>
> In place of that, I ran the *exact* CI command sequence against a **clean copy
> of the repository with every git-ignored artefact removed** — no
> `node_modules/`, no `.next/`, no `.env`, no `dev.db`, no generated Prisma
> client. That is the closest reproduction of a fresh runner available here, and
> it is what § 3 reports. Where a figure is an estimate rather than a
> measurement, it says so.
>
> **Also outstanding: the demo recording.** § 6 contains the shot list and
> script; the recording itself has not been made. Both gaps are stated here
> rather than papered over.

---

## 1. Pipeline Setup

**File:** [`.github/workflows/ci.yml`](ticket-triage/.github/workflows/ci.yml)

### Triggers

```yaml
on:
  pull_request:
  push:
    branches: [main]
```

Pull requests gate the merge; pushes to `main` catch anything that lands by
another route. `concurrency: cancel-in-progress` kills superseded runs — a
superseded run tells nobody anything and the org runner queue is shared.

### Jobs

One job, `verify`, on `ubuntu-latest`, `timeout-minutes: 5`. The timeout is a
tripwire, not the target: NFR-4's real budget is 180 s.

| Step | Command | Pass threshold |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint | `pnpm lint` (ESLint 9, flat config) | **0 errors** |
| Type check | `pnpm typecheck` (`tsc --noEmit`) | **0 errors** |
| Unit tests | `pnpm test` (Vitest) | **100% pass, ≥ 1 test** |
| Build | `pnpm build` (`prisma generate && next build`) | exit 0 |

**Why one job and not four parallel ones.** Four jobs would each pay the ~40 s
install cost, so parallelism would *raise* total runner minutes to shorten
wall-clock. At a 36.5 s gate that trade is not worth making. If the gate ever
passes ~2 minutes, splitting `build` out is the first thing to do.

### Caching strategy

Two caches, and ADR-001 records that **both** are required or NFR-4 fails:

1. **pnpm store** — `actions/setup-node@v4` with `cache: pnpm`.
   `pnpm/action-setup@v4` must run *before* `setup-node`, or the store path
   cannot be resolved. `pnpm/action-setup` takes no version input: it reads
   `packageManager` from `package.json`, which is the single place the pnpm
   version is pinned.
2. **Next.js build cache** — `actions/cache@v4` on `.next/cache`:

```yaml
key: ${{ runner.os }}-next-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('src/**/*.ts', 'src/**/*.tsx') }}
restore-keys: |
  ${{ runner.os }}-next-${{ hashFiles('pnpm-lock.yaml') }}-
  ${{ runner.os }}-next-
```

The key is deps + sources, so any source change misses; the `restore-keys`
ladder then falls back to the newest cache for the same dependency set, so a
one-line change still reuses most of the compile. **Measured effect of the
`.next/cache` hit on this machine: 27.0 s cold compile vs 16.7 s warm — a 10.3 s
saving per run.**

### Deliberate omissions

- **No database service container and no migration step.** Every test runs
  against the in-memory `FakeTicketRepository` (ADR-002), so CI needs no SQLite
  file, no `prisma migrate`, and no Postgres container. This is the single
  biggest reason the gate is under a minute.
- **No separate `prisma generate` step.** The root `postinstall` script already
  runs it, so the `@prisma/client` types exist before `tsc`. A second explicit
  call would be dead weight; the requirement is instead recorded as a comment in
  the workflow so nobody deletes `postinstall` without understanding why.
- **No secrets.** `DATABASE_URL` is set inline in `env:` because it is a local
  file path (`file:./dev.db`), not a credential (NFR-6). `next build` needs it
  present even though every route is `force-dynamic`.

---

## 2. Results Summary

| Metric | Target | Achieved | Verdict |
|--------|--------|----------|---------|
| End-to-end duration | < 3 min | **112.6 s** total from a clean checkout (36.5 s gate + 76.1 s install) | **PASS** |
| Lint errors | 0 | **0 errors, 0 warnings** | **PASS** |
| Type errors | 0 | **0** | **PASS** |
| Test pass rate | 100% | **100% — 42/42 across 4 files** | **PASS** |
| Build | exit 0 | **exit 0** | **PASS** |
| `any` types (NFR-3) | 0 | **0** | **PASS** |
| API p95 (NFR-2) | ≤ 150 ms | **GET 19.7 ms · PATCH 24.3 ms** | **PASS** |
| Page first render (NFR-1) | ≤ 1500 ms | **220 ms** server-side HTML delivery, cold (see caveat) | **PASS, partially measured** |
| Green on `main` in GitHub Actions | required | **NOT RUN** — nothing pushed | **OUTSTANDING** |
| Demo recording ≤ 3:30 | required | **NOT RECORDED** | **OUTSTANDING** |

### Step-by-step timings

Windows 11, Node 24.19.0, pnpm 10.15.0. "Clean checkout" = the repository copied
with every git-ignored artefact excluded, then the CI sequence run from scratch.

| Step | Clean checkout | Warm dev tree | Notes |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | **76.1 s** | — | pnpm store already populated; a genuinely cold store measured **5 m 50 s** on this machine (OneDrive-synced folder, no CI-grade disk) |
| `pnpm lint` | **4.3 s** | 3.6 s | |
| `pnpm typecheck` | **2.1 s** | 2.1 s | |
| `pnpm test` | **3.1 s** | 1.8 s | 42 tests, no database |
| `pnpm build` | **27.0 s** | 16.7 s | cold vs warm `.next/cache` |
| **Gate total** | **36.5 s** | **24.2 s** | |
| **Including install** | **112.6 s** | — | vs the 180 s NFR-4 budget |

**Estimate for GitHub Actions (not measured):** `ubuntu-latest` runners have
faster disks and no OneDrive layer, and the install runs against a warm
`setup-node` pnpm cache. I would expect **60–100 s**, comfortably inside 180 s.
Stated as an estimate because it is one — the number in the table above is the
local measurement, which is the only thing I actually observed.

### Test suite

```
 ✓ tests/logger.test.ts          (5 tests)
 ✓ tests/grouping.test.ts        (6 tests)
 ✓ tests/contracts.test.ts      (13 tests)
 ✓ tests/routes.tickets.test.ts (18 tests)

 Test Files  4 passed (4)
      Tests  42 passed (42)
```

Every test name cites the acceptance criterion it covers (`AC-2.3: rejects an
invalid priority, names the field, and writes nothing`), so a failure names the
requirement it broke rather than a function.

### NFR-2 — API latency (`pnpm bench`, 200 sequential requests after 20 warm-up)

```
┌─────────┬──────────────────────────┬─────┬───────┬───────┬───────┬───────┬───────┐
│ (index) │ label                    │ n   │ mean  │ p50   │ p95   │ p99   │ max   │
├─────────┼──────────────────────────┼─────┼───────┼───────┼───────┼───────┼───────┤
│ 0       │ 'GET /api/tickets'       │ 200 │ 14.13 │ 15.8  │ 19.73 │ 20.43 │ 22.49 │
│ 1       │ 'PATCH /api/tickets/:id' │ 200 │ 16.21 │ 16.15 │ 24.25 │ 27.21 │ 29.93 │
└─────────┴──────────────────────────┴─────┴───────┴───────┴───────┴───────┴───────┘
```

Both p95s are ~6× inside the 150 ms budget. `pnpm bench` exits non-zero on a
breach, so this is a runnable check rather than a one-off observation.

### NFR-1 — Page render, with an honest caveat

```
COLD first request to /tickets after a fresh `pnpm start`:
  ttfb=0.204s  total=0.220s  bytes=50618
warm:
  run 2  ttfb=0.038s  total=0.042s
  run 5  ttfb=0.029s  total=0.035s
```

**What this does and does not prove.** This measures server-side HTML delivery,
not browser Largest Contentful Paint, which is the method PRD § 5 specifies.
220 ms of the 1500 ms budget is spent before the browser has a single byte,
leaving ~1.28 s for parse and paint on a 50 KB fully-server-rendered document —
so the target is very likely met with large margin. But **"very likely" is not
"measured"**, and the DevTools measurement PRD § 5 asks for has not been taken.
Logging it as PASS on the delivery number and flagging the gap is the honest
call.

The architecture is what buys the margin: `/tickets` is a Server Component that
calls the repository in-process rather than fetching its own HTTP API (ADR-001),
so all 20 tickets are in the first HTML payload and nothing depends on hydration.

### NFR-3 — Zero `any`

```bash
$ grep -rn ": any\|as any\|<any>\|any\[\]" src/ tests/ prisma/*.ts scripts/
# (no matches)
```

Backed by `@typescript-eslint/no-explicit-any: "error"`, which fails CI. There
are **no `eslint-disable` comments anywhere in the repository** — see Failure 1,
which is exactly why that matters.

---

## 3. Failures and Fixes

Six things failed during this build. All six are recorded, including the two
that were self-inflicted.

### Failure 1 — A lint-suppression comment hiding a live NFR-7 violation

**Error.** No error. That is the problem. The code was:

```ts
} catch (error) {
  return fail("INTERNAL_ERROR", "Failed to list tickets.", 500, context, undefined);
  // eslint-disable-next-line no-unreachable
  void errorNameOf(error);
}
```

`pnpm lint` passed (the disable comment did its job), `pnpm test` passed
(`buildRequestLog` substitutes `"UnknownError"` for an unnamed 5xx, so the unit
test is green), and `pnpm build` passed. **All four checks were green over a
broken requirement.**

**Root cause.** `fail()` logs the API *error code* as `errorName`; NFR-7 needs
the *exception's* name on a 5xx. Two different values sharing one parameter. I
reached for a suppression instead of resolving the conflict.

**Fix.** [`src/server/routes/tickets.ts:171-178`](ticket-triage/src/server/routes/tickets.ts#L171-L178)
— bypass `fail()` in the catch and call
`respond(payload, 500, context, errorNameOf(error))`. Suppression removed.
Caught by re-reading the diff, not by any gate.

**Lesson, and the action taken.** A gate is only worth its runtime if nothing
may opt out of it. "Never emit an `eslint-disable` comment" is now a standing
rule in `speckit.yaml`'s `conventions.rules`, so every future regeneration
inherits it. The repository currently contains zero suppressions.

### Failure 2 — The generated ESLint config failed its own lint run

**Error.**

```
eslint.config.mjs
  10:1  warning  Assign array to a variable before exporting as module default  import/no-anonymous-default-export

✖ 1 problem (0 errors, 1 warning)
```

**Root cause.** The config was generated in the shape of the `create-next-app`
template, which exports an anonymous array. That template does not lint itself
against `next/core-web-vitals`; this repo does.

**Fix.** [`eslint.config.mjs:12`](ticket-triage/eslint.config.mjs#L12) — assign
to `const config` and export that. Technically the gate ("0 errors") already
passed with the warning present; it was fixed anyway, because a gate whose
output is not empty is a gate people stop reading.

### Failure 3 — pnpm 9.15.4 crashes on Node 24 (clean-checkout only)

**Error.**

```
.../node_modules/unrs-resolver postinstall$ node postinstall.js
C:\...\pnpm\dist\pnpm.cjs:101678
        throw new Error("readStream must be readable");
Error: readStream must be readable
    at createLineStream (...pnpm.cjs:101678:15)
    at runPackageLifecycle (...pnpm.cjs:102251:7)
Node.js v24.19.0
```

`install` exited 1, and **all four checks then failed for a second, misleading
reason** — there was no `node_modules/.bin`:

```
> eslint .
node.exe : 'eslint' is not recognized as an internal or external command,
```

Four red checks, one root cause. Worth knowing before debugging a red board.

**Root cause, in two layers.** pnpm 9.15.x's lifecycle-script runner is
incompatible with Node ≥ 22. Then: installing pnpm 10 globally changed nothing,
because `package.json` pinned `"packageManager": "pnpm@9.15.4"` and pnpm
re-executes whatever that field names — visible in the stack trace path,
`AppData\Local\pnpm\.tools\pnpm\9.15.4\`, *while pnpm 10.15.0 was the installed
binary*.

**Fix.** Bump the pin, not the global install —
[`package.json:10`](ticket-triage/package.json#L10) → `pnpm@10.15.0` — and
document the trap in the README so the next person does not lose the same 20
minutes. **GitHub Actions was never exposed to this:** the workflow pins
`node-version: 20`. It is a local-developer bug, and the README quick-start is
where it needed fixing.

### Failure 4 — Self-inflicted: "fixing" a warning broke the install

Fixing Failure 3 surfaced a cosmetic message, `Ignored build scripts:
@prisma/engines`. I added `@prisma/engines` to `onlyBuiltDependencies`, which
made its previously-skipped postinstall actually run:

```
.../node_modules/@prisma/engines postinstall$ node scripts/postinstall.js
.../node_modules/@prisma/engines postinstall: Failed
 ELIFECYCLE  Command failed with exit code -4058.
```

**Root cause.** I treated a warning as a defect without understanding it. The
script was being skipped *correctly* — `prisma generate` fetches the engines
itself — and enabling it turned a harmless message into a hard install failure
(`-4058` = `ENOENT`).

**Fix.** [`package.json:52-54`](ticket-triage/package.json#L52-L54) — move it to
`ignoredBuiltDependencies`, which silences the warning by **recording the
decision** instead of reversing it.

### Failure 5 — Windows MAX_PATH, mis-reported as a missing binary

**Error.**

```
Error: The service was stopped: spawn C:\...\node_modules\.pnpm\@esbuild+win32-x64@0.28.2\node_modules\@esbuild\win32-x64\esbuild.exe ENOENT
```

**Root cause.** `ENOENT` on a file that demonstrably existed:
`Get-Item` reported it at 11,694,592 bytes and running it directly printed
`0.28.2`. The path was **~280 characters**, over Windows' 260-character
`CreateProcess` limit — PowerShell's long-path-aware APIs could see and run it,
Node's `child_process.spawn` could not.

**Fix.** No repository change. Re-running the identical clean checkout under a
140-character path fixed it, and also cut `pnpm lint` from **102.8 s to 4.3 s**
(the same long paths were thrashing ESLint's resolver). Both results are in § 2.

**Why it is recorded anyway.** It is not a repo defect and it cannot occur on
`ubuntu-latest`, but it consumed real debugging time and it is exactly the kind
of failure that gets misdiagnosed as "the dependency is broken." A clone into a
deeply nested Windows path will hit it.

### Failure 6 — A risk checked and found clear

`next-env.d.ts` is git-ignored, and CI runs `typecheck` **before** `build` — so
on a fresh runner the file does not exist when `tsc` runs. I expected this to
fail. Tested by deleting `next-env.d.ts`, `.next/` and `tsconfig.tsbuildinfo`:

```
=== simulating a fresh checkout: typecheck with no next-env.d.ts and no .next ===
> tsc --noEmit
=== TYPECHECK EXIT 0 ===
```

Clean. React and JSX types resolve from `@types/react`; `next-env.d.ts` only
adds image and navigation module declarations this codebase does not use.
Recorded because "I checked and it was fine" is worth as much to the next
reader as a bug.

