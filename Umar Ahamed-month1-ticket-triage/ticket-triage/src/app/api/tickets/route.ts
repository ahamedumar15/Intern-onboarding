/**
 * Adapter only (ADR-001). All behaviour lives in `src/server/routes/tickets.ts`,
 * which knows nothing about Next.js.
 */
import { prismaTicketRepository } from "@/server/repository/prisma-ticket-repository";
import { listTickets } from "@/server/routes/tickets";

// The board must never be served from a build-time snapshot: a stale board is
// worse than a slow one for the Monday review (ADR-001 § Consequences).
export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return listTickets(request, { repository: prismaTicketRepository });
}
