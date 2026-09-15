import { describe, expect, it } from "vitest";
import type { Ticket } from "@/lib/contracts";
import { groupByPriority, totalOf } from "@/lib/grouping";

function ticket(overrides: Partial<Ticket> & { id: string }): Ticket {
  return {
    reference: `PMO-${overrides.id}`,
    title: "Blocker",
    description: "",
    squad: "Apex",
    status: "OPEN",
    priority: null,
    owner: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupByPriority (FR-4)", () => {
  it("AC-4.1: always returns exactly four groups in P0, P1, P2, Untriaged order", () => {
    const groups = groupByPriority([]);
    expect(groups.map((group) => group.key)).toEqual([
      "P0",
      "P1",
      "P2",
      "UNTRIAGED",
    ]);
  });

  it("AC-4.2: renders empty groups with a zero count rather than omitting them", () => {
    const groups = groupByPriority([ticket({ id: "1", priority: "P1" })]);
    const counts = Object.fromEntries(
      groups.map((group) => [group.key, group.count]),
    );
    expect(counts).toEqual({ P0: 0, P1: 1, P2: 0, UNTRIAGED: 0 });
  });

  it("AC-4.2: a ticket with no priority lands in Untriaged, not in P2", () => {
    const groups = groupByPriority([ticket({ id: "1", priority: null })]);
    expect(groups.find((group) => group.key === "UNTRIAGED")?.count).toBe(1);
    expect(groups.find((group) => group.key === "P2")?.count).toBe(0);
  });

  it("AC-4.3: the badges sum to the total ticket count", () => {
    const tickets: Ticket[] = [
      ticket({ id: "1", priority: "P0" }),
      ticket({ id: "2", priority: "P0" }),
      ticket({ id: "3", priority: "P2" }),
      ticket({ id: "4", priority: null }),
    ];
    expect(totalOf(groupByPriority(tickets))).toBe(tickets.length);
  });

  it("AC-4.4: orders tickets inside a group by createdAt ascending", () => {
    const groups = groupByPriority([
      ticket({
        id: "newer",
        priority: "P0",
        createdAt: "2026-08-20T00:00:00.000Z",
      }),
      ticket({
        id: "older",
        priority: "P0",
        createdAt: "2026-08-02T00:00:00.000Z",
      }),
    ]);
    expect(
      groups.find((group) => group.key === "P0")?.tickets.map((t) => t.id),
    ).toEqual(["older", "newer"]);
  });

  it("does not mutate the array it was given", () => {
    const tickets = [
      ticket({ id: "b", priority: "P0", createdAt: "2026-08-20T00:00:00.000Z" }),
      ticket({ id: "a", priority: "P0", createdAt: "2026-08-02T00:00:00.000Z" }),
    ];
    groupByPriority(tickets);
    expect(tickets.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
