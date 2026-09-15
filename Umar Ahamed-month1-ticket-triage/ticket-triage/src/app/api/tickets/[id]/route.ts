/**
 * Adapter only (ADR-001). All behaviour lives in `src/server/routes/tickets.ts`.
 */
import { prismaTicketRepository } from "@/server/repository/prisma-ticket-repository";
import { updateTicket } from "@/server/routes/tickets";

export const dynamic = "force-dynamic";

// Next 15 hands route params as a Promise.
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return updateTicket(request, id, { repository: prismaTicketRepository });
}
