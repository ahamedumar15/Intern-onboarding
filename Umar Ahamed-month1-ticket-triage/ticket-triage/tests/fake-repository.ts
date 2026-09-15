/**
 * In-memory `TicketRepository` (ADR-002).
 *
 * The whole suite runs against this, so `pnpm test` needs no database, no
 * migration and no `prisma generate` — which is what keeps CI inside NFR-4.
 * It also counts reads, so AC-1.4's "no database read is performed" is an
 * assertion rather than an assumption.
 */
import type { Status } from "@/lib/contracts";
import type {
  TicketPatch,
  TicketRecord,
  TicketRepository,
} from "@/server/repository/ticket-repository";

let sequence = 0;

export function makeTicket(
  overrides: Partial<TicketRecord> = {},
): TicketRecord {
  sequence += 1;
  const base: TicketRecord = {
    id: `tkt_${String(sequence).padStart(3, "0")}`,
    reference: `PMO-${String(2000 + sequence)}`,
    title: `Blocker ${String(sequence)}`,
    description: "Seeded fixture.",
    squad: "Apex",
    status: "OPEN",
    priority: null,
    owner: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  };
  return { ...base, ...overrides };
}

export class FakeTicketRepository implements TicketRepository {
  public listCalls = 0;
  public updateCalls = 0;

  private readonly rows = new Map<string, TicketRecord>();

  constructor(seed: readonly TicketRecord[] = []) {
    for (const row of seed) this.rows.set(row.id, row);
  }

  get all(): TicketRecord[] {
    return [...this.rows.values()];
  }

  async listByStatus(status: Status): Promise<TicketRecord[]> {
    this.listCalls += 1;
    return this.all
      .filter((row) => row.status === status)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findById(id: string): Promise<TicketRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, patch: TicketPatch): Promise<TicketRecord | null> {
    this.updateCalls += 1;
    const existing = this.rows.get(id);
    if (existing === undefined) return null;

    const updated: TicketRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date("2026-08-30T00:00:00.000Z"),
    };
    this.rows.set(id, updated);
    return updated;
  }
}
