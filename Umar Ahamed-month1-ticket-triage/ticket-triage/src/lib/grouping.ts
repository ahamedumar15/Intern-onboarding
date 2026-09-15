/**
 * FR-4 — group tickets by priority with counts.
 *
 * Kept as a pure function with no I/O so the empty-group rule (AC-4.2) and the
 * ordering rule (AC-4.4) are asserted in `tests/grouping.test.ts` rather than
 * eyeballed in a browser.
 */
import {
  GROUP_LABELS,
  GROUP_ORDER,
  UNTRIAGED,
  type GroupKey,
  type Ticket,
  type TicketGroup,
} from "@/lib/contracts";

function groupKeyOf(ticket: Ticket): GroupKey {
  return ticket.priority ?? UNTRIAGED;
}

function byCreatedAtAscending(a: Ticket, b: Ticket): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

/**
 * Always returns exactly four groups in the order P0, P1, P2, Untriaged —
 * including empty ones (AC-4.2: a missing P0 heading is indistinguishable from
 * a bug). Within a group, oldest blocker first (AC-4.4).
 */
export function groupByPriority(tickets: readonly Ticket[]): TicketGroup[] {
  return GROUP_ORDER.map((key) => {
    const inGroup = tickets
      .filter((ticket) => groupKeyOf(ticket) === key)
      .sort(byCreatedAtAscending);

    return {
      key,
      label: GROUP_LABELS[key],
      count: inGroup.length,
      tickets: inGroup,
    };
  });
}

/** AC-4.3 — the group badges must sum to the header total. */
export function totalOf(groups: readonly TicketGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}
