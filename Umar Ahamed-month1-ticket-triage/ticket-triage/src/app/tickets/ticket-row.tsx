"use client";

/**
 * FR-2 + FR-3 — set a ticket's priority and owner in one interaction each.
 *
 * The only client component on the board. It PATCHes `/api/tickets/:id` and
 * then calls `router.refresh()`, so the server re-renders the groups and the
 * ticket physically moves between them (AC-2.1).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  ApiErrorSchema,
  PrioritySchema,
  type Priority,
  type Ticket,
  type UpdateTicketInput,
} from "@/lib/contracts";

const SQUAD_CHIP =
  "rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide " +
  "bg-board-line text-board-muted";

export function TicketRow({ ticket }: { ticket: Ticket }): ReactNode {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ownerDraft, setOwnerDraft] = useState(ticket.owner ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function patch(body: UpdateTicketInput): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // NFR-8 — every non-2xx shares one envelope, so one branch handles all.
        const parsed = ApiErrorSchema.safeParse(await response.json());
        setError(
          parsed.success
            ? parsed.data.error.message
            : `Update failed (HTTP ${String(response.status)}).`,
        );
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setIsSaving(false);
    }
  }

  function onPriorityChange(value: string): void {
    const parsed = PrioritySchema.safeParse(value);
    // The empty option means "un-triage this", which the API spells as null
    // (AC-2.4).
    const priority: Priority | null = parsed.success ? parsed.data : null;
    void patch({ priority });
  }

  function commitOwner(): void {
    const trimmed = ownerDraft.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next === ticket.owner) return;
    // Clearing the box is the UI's gesture for un-assigning, so it is sent as
    // null — never as "" , which the API rejects on purpose (AC-3.3).
    void patch({ owner: next });
  }

  const busy = isSaving || isPending;

  return (
    <article
      className={`rounded-lg border border-board-line bg-white px-4 py-3 transition-opacity ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-board-muted">
              {ticket.reference}
            </span>
            <span className={SQUAD_CHIP}>{ticket.squad}</span>
          </div>
          <h3 className="mt-1 truncate text-sm font-medium">{ticket.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-board-muted">
            {ticket.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor={`priority-${ticket.id}`}>
            Priority for {ticket.reference}
          </label>
          <select
            id={`priority-${ticket.id}`}
            className="rounded border border-board-line bg-white px-2 py-1 text-xs"
            value={ticket.priority ?? ""}
            disabled={busy}
            onChange={(event) => {
              onPriorityChange(event.target.value);
            }}
          >
            <option value="">Untriaged</option>
            {PrioritySchema.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor={`owner-${ticket.id}`}>
            Owner for {ticket.reference}
          </label>
          <input
            id={`owner-${ticket.id}`}
            className="w-44 rounded border border-board-line bg-white px-2 py-1 text-xs"
            placeholder="Unowned"
            maxLength={120}
            value={ownerDraft}
            disabled={busy}
            onChange={(event) => {
              setOwnerDraft(event.target.value);
            }}
            onBlur={commitOwner}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </div>
      </div>

      {error !== null && (
        <p role="alert" className="mt-2 text-xs text-p0">
          {error}
        </p>
      )}
    </article>
  );
}
