/**
 * NFR-2 — measures p95 latency for GET /api/tickets and PATCH /api/tickets/:id.
 *
 * Usage:
 *   pnpm build && pnpm start        # in one terminal
 *   pnpm bench                      # in another
 *
 * Sequential by design: NFR-2 is a single-user latency budget for a 6-person
 * PMO, not a throughput target. Concurrency here would measure the event loop,
 * not the thing the PRD promises.
 */

const BASE_URL = process.env.BENCH_URL ?? "http://localhost:3000";
const SAMPLES = Number(process.env.BENCH_SAMPLES ?? "200");
const WARMUP = 20;
const BUDGET_MS = 150;

function percentile(sorted, p) {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[index];
}

function summarise(label, samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    label,
    n: sorted.length,
    mean: Number(mean.toFixed(2)),
    p50: Number(percentile(sorted, 50).toFixed(2)),
    p95: Number(percentile(sorted, 95).toFixed(2)),
    p99: Number(percentile(sorted, 99).toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

async function timed(request) {
  const started = performance.now();
  const response = await request();
  await response.arrayBuffer();
  return { ms: performance.now() - started, status: response.status };
}

async function run(label, request) {
  for (let i = 0; i < WARMUP; i += 1) await timed(request);

  const samples = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const { ms, status } = await timed(request);
    if (status >= 400) {
      throw new Error(`${label}: unexpected HTTP ${status}`);
    }
    samples.push(ms);
  }
  return summarise(label, samples);
}

async function main() {
  const listResponse = await fetch(`${BASE_URL}/api/tickets`);
  if (!listResponse.ok) {
    throw new Error(
      `Cannot reach ${BASE_URL}/api/tickets (HTTP ${listResponse.status}). ` +
        "Run `pnpm build && pnpm start` first.",
    );
  }

  const board = await listResponse.json();
  const firstTicket = board.groups.flatMap((group) => group.tickets)[0];
  if (firstTicket === undefined) {
    throw new Error("No tickets found. Run `pnpm db:reset` first.");
  }

  const results = [
    await run("GET /api/tickets", () => fetch(`${BASE_URL}/api/tickets`)),
    await run("PATCH /api/tickets/:id", () =>
      fetch(`${BASE_URL}/api/tickets/${firstTicket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priority: firstTicket.priority }),
      }),
    ),
  ];

  console.table(results);

  const breaches = results.filter((result) => result.p95 > BUDGET_MS);
  for (const breach of breaches) {
    console.error(
      `NFR-2 breach: ${breach.label} p95 ${breach.p95} ms > ${BUDGET_MS} ms`,
    );
  }
  process.exitCode = breaches.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
