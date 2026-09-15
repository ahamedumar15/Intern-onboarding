/**
 * FR-1, FR-2, FR-3, FR-5 — the ticket API.
 *
 * These handlers take a Web `Request` and return a Web `Response`. They import
 * nothing from `next/*` (ADR-001, enforced by an ESLint `no-restricted-imports`
 * rule), so they are unit-testable with no Next.js harness and portable if the
 * framework ever changes. `src/app/api/**` holds the four-line adapters.
 *
 * Dependencies are passed in rather than imported so the tests can supply an
 * in-memory repository (ADR-002).
 */
import {
  ListQuerySchema,
  UpdateTicketSchema,
  toErrorDetails,
  type ApiError,
  type ApiErrorCode,
  type ApiErrorDetail,
  type ListTicketsResponse,
} from "@/lib/contracts";
import { groupByPriority } from "@/lib/grouping";
import { logRequest, newRequestId } from "@/lib/logger";
import {
  toTicketDto,
  type TicketRepository,
} from "@/server/repository/ticket-repository";

export type RouteDeps = {
  repository: TicketRepository;
};

type RequestContext = {
  requestId: string;
  method: string;
  path: string;
  startedAt: number;
};

function startContext(request: Request): RequestContext {
  return {
    requestId: newRequestId(),
    method: request.method,
    path: new URL(request.url).pathname,
    startedAt: performance.now(),
  };
}

/** Single exit point, so NFR-7's "one log line per response" holds by design. */
function respond(
  body: unknown,
  status: number,
  context: RequestContext,
  errorName?: string,
): Response {
  logRequest({
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    status,
    durationMs: Math.round(performance.now() - context.startedAt),
    ...(errorName === undefined ? {} : { errorName }),
  });
  return Response.json(body, {
    status,
    headers: { "x-request-id": context.requestId },
  });
}

/** Every non-2xx response goes through here, which is what makes NFR-8 true. */
function fail(
  code: ApiErrorCode,
  message: string,
  status: number,
  context: RequestContext,
  details?: ApiErrorDetail[],
): Response {
  const payload: ApiError = {
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
  return respond(payload, status, context, code);
}

type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false };

/** AC-5.5 — malformed JSON is a 400, never a 500. */
async function parseJsonBody(request: Request): Promise<JsonParseResult> {
  try {
    return { ok: true, value: (await request.json()) as unknown };
  } catch {
    return { ok: false };
  }
}

function errorNameOf(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

/* -------------------------------------------------------------------------- */
/* GET /api/tickets — FR-1, FR-4                                               */
/* -------------------------------------------------------------------------- */

export async function listTickets(
  request: Request,
  deps: RouteDeps,
): Promise<Response> {
  const context = startContext(request);

  try {
    // AC-5.1 / AC-1.4: validate before touching the database. An invalid
    // status must cost zero database reads.
    const url = new URL(request.url);
    const query = ListQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );

    if (!query.success) {
      return fail(
        "INVALID_QUERY",
        "Invalid query string.",
        400,
        context,
        toErrorDetails(query.error),
      );
    }

    const records = await deps.repository.listByStatus(query.data.status);
    const tickets = records.map(toTicketDto);

    const body: ListTicketsResponse = {
      status: query.data.status,
      total: tickets.length,
      groups: groupByPriority(tickets),
    };

    return respond(body, 200, context);
  } catch (error) {
    // NFR-7: a 5xx must carry the real error name, so this path bypasses
    // `fail()` (which logs the API error code instead).
    const payload: ApiError = {
      error: { code: "INTERNAL_ERROR", message: "Failed to list tickets." },
    };
    return respond(payload, 500, context, errorNameOf(error));
  }
}

/* -------------------------------------------------------------------------- */
/* PATCH /api/tickets/:id — FR-2, FR-3, FR-5                                   */
/* -------------------------------------------------------------------------- */

export async function updateTicket(
  request: Request,
  id: string,
  deps: RouteDeps,
): Promise<Response> {
  const context = startContext(request);

  try {
    const raw = await parseJsonBody(request);
    if (!raw.ok) {
      return fail("INVALID_JSON", "Request body is not valid JSON.", 400, context);
    }

    const parsed = UpdateTicketSchema.safeParse(raw.value);
    if (!parsed.success) {
      // AC-2.3 / AC-3.3 / AC-3.4 / AC-5.2 — `details` names the failing field.
      return fail(
        "INVALID_BODY",
        "Request body failed validation.",
        400,
        context,
        toErrorDetails(parsed.error),
      );
    }

    // AC-5.3 — a patch that changes nothing is a client bug, not a no-op.
    if (Object.keys(parsed.data).length === 0) {
      return fail(
        "EMPTY_PATCH",
        "Provide at least one of: priority, owner, status.",
        400,
        context,
      );
    }

    const updated = await deps.repository.update(id, parsed.data);
    if (updated === null) {
      return fail(
        "TICKET_NOT_FOUND",
        `No ticket with id "${id}".`,
        404,
        context,
      );
    }

    return respond(toTicketDto(updated), 200, context);
  } catch (error) {
    const payload: ApiError = {
      error: { code: "INTERNAL_ERROR", message: "Failed to update ticket." },
    };
    return respond(payload, 500, context, errorNameOf(error));
  }
}
