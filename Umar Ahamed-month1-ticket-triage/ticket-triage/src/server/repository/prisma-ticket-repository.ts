/**
 * The Prisma-backed `TicketRepository` (ADR-002).
 *
 * This is the ONLY module in the codebase that writes to the database. Keeping
 * it that way is what makes ADR-003's "Zod is the single line of defence"
 * claim true — if a write path ever bypasses `UpdateTicketSchema`, it has to
 * appear here first.
 */
import { prisma } from "@/lib/db";
import type { Status } from "@/lib/contracts";
import {
  toTicketRecord,
  type TicketPatch,
  type TicketRecord,
  type TicketRepository,
} from "@/server/repository/ticket-repository";

/** Prisma's "record to update not found" error (AC-5.4). */
function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

export const prismaTicketRepository: TicketRepository = {
  async listByStatus(status: Status): Promise<TicketRecord[]> {
    // Uses the (status, priority) index from PRD § 6. Ordering is re-applied by
    // `groupByPriority` (AC-4.4); doing it here too keeps the raw API response
    // stable for clients that skip the grouping.
    const rows = await prisma.ticket.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toTicketRecord);
  },

  async findById(id: string): Promise<TicketRecord | null> {
    const row = await prisma.ticket.findUnique({ where: { id } });
    return row === null ? null : toTicketRecord(row);
  },

  async update(id: string, patch: TicketPatch): Promise<TicketRecord | null> {
    try {
      const row = await prisma.ticket.update({ where: { id }, data: patch });
      return toTicketRecord(row);
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  },
};
