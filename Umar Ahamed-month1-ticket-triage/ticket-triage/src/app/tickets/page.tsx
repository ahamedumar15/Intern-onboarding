/**
 * FR-1 + FR-4 — the triage board.
 *
 * A Server Component that calls the repository directly rather than fetching
 * its own HTTP API (ADR-001): the ticket rows are in the first HTML payload, so
 * NFR-1's 1500 ms does not depend on hydration speed.
 */
import type { ReactNode } from "react";
import { type GroupKey } from "@/lib/contracts";
import { groupByPriority, totalOf } from "@/lib/grouping";
import { prismaTicketRepository } from "@/server/repository/prisma-ticket-repository";
import { toTicketDto } from "@/server/repository/ticket-repository";
import { TicketRow } from "./ticket-row";

// A stale board is worse than a slow one for the Monday review.
export const dynamic = "force-dynamic";

const GROUP_STYLES: Readonly<Record<GroupKey, { dot: string; badge: string }>> = {
  P0: { dot: "bg-p0", badge: "bg-p0/10 text-p0 ring-p0/25" },
  P1: { dot: "bg-p1", badge: "bg-p1/10 text-p1 ring-p1/25" },
  P2: { dot: "bg-p2", badge: "bg-p2/10 text-p2 ring-p2/25" },
  UNTRIAGED: {
    dot: "bg-untriaged",
    badge: "bg-untriaged/10 text-untriaged ring-untriaged/25",
  },
};

function Stat({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs uppercase tracking-wide text-board-muted">
        {label}
      </span>
    </div>
  );
}

export default async function TicketsPage(): Promise<ReactNode> {
  const records = await prismaTicketRepository.listByStatus("OPEN");
  const tickets = records.map(toTicketDto);
  const groups = groupByPriority(tickets);

  // AC-4.3 — the header total is derived from the same badges the board shows,
  // so the two can never disagree.
  const total = totalOf(groups);
  const untriaged = tickets.filter((ticket) => ticket.priority === null).length;
  const unowned = tickets.filter((ticket) => ticket.owner === null).length;

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8 flex items-end justify-between border-b border-board-line pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            PMO Triage Board
          </h1>
          <p className="mt-1 text-sm text-board-muted">
            Open delivery blockers across six client squads, grouped by
            priority.
          </p>
        </div>
        <div className="flex gap-8">
          <Stat label="Open" value={total} />
          <Stat label="Untriaged" value={untriaged} />
          <Stat label="Unowned" value={unowned} />
        </div>
      </header>

      <div className="space-y-8">
        {groups.map((group) => {
          const style = GROUP_STYLES[group.key];
          return (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <div className="mb-3 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${style.dot}`}
                />
                <h2
                  id={`group-${group.key}`}
                  className="text-sm font-semibold uppercase tracking-wide"
                >
                  {group.label}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${style.badge}`}
                  data-testid={`count-${group.key}`}
                >
                  {group.count}
                </span>
              </div>

              {/* AC-4.2 — empty groups still render, with a 0 badge above. */}
              {group.count === 0 ? (
                <p className="rounded-lg border border-dashed border-board-line px-4 py-6 text-sm text-board-muted">
                  Nothing here. Good.
                </p>
              ) : (
                <ul className="space-y-2">
                  {group.tickets.map((ticket) => (
                    <li key={ticket.id}>
                      <TicketRow ticket={ticket} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
