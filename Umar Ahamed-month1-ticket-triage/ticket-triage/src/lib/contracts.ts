/**
 * The single source of truth for every shape that crosses an HTTP boundary
 * (ADR-003). The dashboard and the API import the same schemas, so a change
 * here breaks the build on both sides at once.
 *
 * This file is load-bearing: ADR-002 accepted that SQLite cannot enforce the
 * priority/status enums, so these schemas are the ONLY thing stopping
 * `priority = "P9"` reaching the database.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Enumerations — written down exactly once, types derived (NFR-3)             */
/* -------------------------------------------------------------------------- */

export const PrioritySchema = z.enum(["P0", "P1", "P2"]);
export type Priority = z.infer<typeof PrioritySchema>;

export const StatusSchema = z.enum(["OPEN", "TRIAGED", "CLOSED"]);
export type Status = z.infer<typeof StatusSchema>;

/** Display order for FR-4. `UNTRIAGED` is a view concept, not a stored value. */
export const UNTRIAGED = "UNTRIAGED" as const;

export const GroupKeySchema = z.union([PrioritySchema, z.literal(UNTRIAGED)]);
export type GroupKey = z.infer<typeof GroupKeySchema>;

/** AC-4.1: exactly these four groups, always in this order. */
export const GROUP_ORDER: readonly GroupKey[] = [
  ...PrioritySchema.options,
  UNTRIAGED,
];

export const GROUP_LABELS: Readonly<Record<GroupKey, string>> = {
  P0: "P0 · Critical",
  P1: "P1 · High",
  P2: "P2 · Normal",
  UNTRIAGED: "Untriaged",
};

/* -------------------------------------------------------------------------- */
/* Field-level rules (PRD § 6, AC-3.2 … AC-3.4)                                */
/* -------------------------------------------------------------------------- */

export const OWNER_MAX_LENGTH = 120;

/**
 * AC-3.2 trims, AC-3.3 rejects the empty string, AC-3.4 caps the length.
 * `.trim()` runs before `.min()`, so "   " is also a 400 — whitespace is a
 * fat-fingered save, not an un-assignment. Un-assigning is `null`.
 */
export const OwnerSchema = z
  .string()
  .trim()
  .min(1, "owner must not be empty — send null to un-assign")
  .max(OWNER_MAX_LENGTH, `owner must be ${OWNER_MAX_LENGTH} characters or fewer`);

/* -------------------------------------------------------------------------- */
/* Wire representation of a Ticket                                             */
/* -------------------------------------------------------------------------- */

/**
 * The serialised ticket. Timestamps are ISO strings because this shape crosses
 * the server/client component boundary as well as the HTTP boundary; the
 * `Date`-typed database row is `TicketRecord` in the repository module.
 */
export const TicketSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string(),
  squad: z.string().min(1),
  status: StatusSchema,
  priority: PrioritySchema.nullable(),
  owner: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Ticket = z.infer<typeof TicketSchema>;

/* -------------------------------------------------------------------------- */
/* Request schemas                                                             */
/* -------------------------------------------------------------------------- */

/** FR-1 / AC-1.2 / AC-1.3 / AC-1.4. Defaults to OPEN — the PMO's working set. */
export const ListQuerySchema = z
  .object({
    status: StatusSchema.default("OPEN"),
  })
  .strict();
export type ListQuery = z.infer<typeof ListQuerySchema>;

/**
 * FR-2 / FR-3 / AC-5.2. `.strict()` so an unknown key is a 400 rather than a
 * silent no-op — silently dropping a typo'd field is how a PMO user concludes
 * "the tool doesn't save my edits".
 *
 * Emptiness is deliberately NOT checked here: the route handler reports it as
 * `EMPTY_PATCH` (AC-5.3) so the error code stays distinguishable from a
 * validation failure.
 */
export const UpdateTicketSchema = z
  .object({
    priority: PrioritySchema.nullable(),
    owner: OwnerSchema.nullable(),
    status: StatusSchema,
  })
  .partial()
  .strict();
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;

/* -------------------------------------------------------------------------- */
/* Response schemas                                                            */
/* -------------------------------------------------------------------------- */

export const TicketGroupSchema = z.object({
  key: GroupKeySchema,
  label: z.string(),
  count: z.number().int().nonnegative(),
  tickets: z.array(TicketSchema),
});
export type TicketGroup = z.infer<typeof TicketGroupSchema>;

export const ListTicketsResponseSchema = z.object({
  status: StatusSchema,
  total: z.number().int().nonnegative(),
  groups: z.array(TicketGroupSchema),
});
export type ListTicketsResponse = z.infer<typeof ListTicketsResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Error envelope (NFR-8) — every non-2xx response has this shape              */
/* -------------------------------------------------------------------------- */

export const ApiErrorCodeSchema = z.enum([
  "INVALID_QUERY",
  "INVALID_JSON",
  "INVALID_BODY",
  "EMPTY_PATCH",
  "TICKET_NOT_FOUND",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
    details: z.array(ApiErrorDetailSchema).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Turns Zod issues into the `details` array of the NFR-8 envelope. */
export function toErrorDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}
