/**
 * The repository seam (ADR-002).
 *
 * Route handlers depend on this interface, never on Prisma, so `pnpm test` runs
 * against an in-memory fake with no database, no migration and no
 * `prisma generate` step. That is what keeps the CI job inside NFR-4's 180 s.
 *
 * This module is deliberately runtime-free with respect to Prisma — the only
 * `@prisma/client` import is a type import, erased at build time.
 */
import {
  PrioritySchema,
  StatusSchema,
  type Priority,
  type Status,
  type Ticket,
} from "@/lib/contracts";
import type { Ticket as PrismaTicket } from "@prisma/client";

/** A ticket as it exists in the database: timestamps are `Date`, not strings. */
export type TicketRecord = {
  id: string;
  reference: string;
  title: string;
  description: string;
  squad: string;
  status: Status;
  priority: Priority | null;
  owner: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** The subset of fields FR-2 and FR-3 allow a client to change. */
export type TicketPatch = {
  priority?: Priority | null;
  owner?: string | null;
  status?: Status;
};

export interface TicketRepository {
  listByStatus(status: Status): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  /** Resolves to `null` when no ticket has that id (AC-5.4). */
  update(id: string, patch: TicketPatch): Promise<TicketRecord | null>;
}

/**
 * Narrows the two String columns ADR-002 could not make enums.
 *
 * This parses rather than casts on purpose: if something ever writes `"P9"`
 * straight into the file, this throws at the boundary instead of handing an
 * impossible `Priority` to the UI.
 */
export function toTicketRecord(row: PrismaTicket): TicketRecord {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    description: row.description,
    squad: row.squad,
    status: StatusSchema.parse(row.status),
    priority: PrioritySchema.nullable().parse(row.priority),
    owner: row.owner,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Database row → wire shape. Dates become ISO strings (see `TicketSchema`). */
export function toTicketDto(record: TicketRecord): Ticket {
  return {
    id: record.id,
    reference: record.reference,
    title: record.title,
    description: record.description,
    squad: record.squad,
    status: record.status,
    priority: record.priority,
    owner: record.owner,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
