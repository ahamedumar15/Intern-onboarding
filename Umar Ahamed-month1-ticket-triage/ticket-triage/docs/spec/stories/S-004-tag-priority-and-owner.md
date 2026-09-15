# S-004 — Tag a ticket with a priority and an owner

- **FR:** FR-2, FR-3 · **Goals:** G-2, G-3 · **Tasks:** T6, T8

> **As** Nadeesha,
> **I want** to set a ticket's priority and owner in one interaction each,
> **so that** 100% of open tickets carry both fields by the 09:30 review
> (88% → 100% priority, 81% → 100% owner).

## Acceptance criteria

Inherits **AC-2.1 … AC-2.4** and **AC-3.1 … AC-3.4** from PRD §4. Summarised:

- Selecting a priority in the dashboard persists it and moves the ticket to that
  group without a full page reload.
- `PATCH /api/tickets/:id` with `{"priority":"P1"}` → `200` with the updated ticket.
- `{"priority":"P9"}` → `400`, `priority` named in `details`, stored row unchanged.
- `{"priority":null}` → `200`, ticket returns to Untriaged (deliberate un-set).
- Owner is trimmed on write; `{"owner":""}` → `400`; `{"owner":null}` un-assigns;
  owner longer than 120 chars → `400`.
- Unknown ticket id → `404 TICKET_NOT_FOUND`; `{}` → `400 EMPTY_PATCH`;
  malformed JSON → `400 INVALID_JSON`, never a 500.

## Notes

`null` and `""` mean different things and this is deliberate: `null` is
"un-assign this", `""` is almost always a UI bug or a fat-fingered save. Treating
them the same would let the tool quietly wipe an owner.

## Done when

`tests/routes.tickets.test.ts` covers every case above and passes.
