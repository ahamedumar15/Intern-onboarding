import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiErrorSchema,
  ListTicketsResponseSchema,
  TicketSchema,
} from "@/lib/contracts";
import { listTickets, updateTicket } from "@/server/routes/tickets";
import { FakeTicketRepository, makeTicket } from "./fake-repository";

/** Route handlers log one line per response (NFR-7); keep the suite quiet. */
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
});

function get(url: string): Request {
  return new Request(url, { method: "GET" });
}

function patch(body: string): Request {
  return new Request("http://localhost/api/tickets/tkt", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  });
}

function seededRepository(): FakeTicketRepository {
  return new FakeTicketRepository([
    makeTicket({
      id: "open-p0",
      status: "OPEN",
      priority: "P0",
      owner: "Nadeesha Perera",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    }),
    makeTicket({
      id: "open-untriaged",
      status: "OPEN",
      priority: null,
      owner: null,
      createdAt: new Date("2026-08-05T00:00:00.000Z"),
    }),
    makeTicket({ id: "closed-one", status: "CLOSED", priority: "P2" }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* GET /api/tickets                                                            */
/* -------------------------------------------------------------------------- */

describe("listTickets (FR-1, FR-4, FR-5)", () => {
  it("AC-1.2: returns 200 JSON containing only OPEN tickets by default", async () => {
    const repository = seededRepository();
    const response = await listTickets(get("http://localhost/api/tickets"), {
      repository,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = ListTicketsResponseSchema.parse(await response.json());
    expect(body.status).toBe("OPEN");
    expect(body.total).toBe(2);

    const ids = body.groups.flatMap((group) =>
      group.tickets.map((ticket) => ticket.id),
    );
    expect(ids).toContain("open-p0");
    expect(ids).not.toContain("closed-one");
  });

  it("AC-1.3: honours ?status=CLOSED", async () => {
    const response = await listTickets(
      get("http://localhost/api/tickets?status=CLOSED"),
      { repository: seededRepository() },
    );

    const body = ListTicketsResponseSchema.parse(await response.json());
    expect(body.status).toBe("CLOSED");
    expect(body.total).toBe(1);
  });

  it("AC-1.4: rejects an unknown status with 400 and reads nothing from the store", async () => {
    const repository = seededRepository();
    const response = await listTickets(
      get("http://localhost/api/tickets?status=BANANA"),
      { repository },
    );

    expect(response.status).toBe(400);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("INVALID_QUERY");
    expect(repository.listCalls).toBe(0);
  });

  it("AC-4.1: the response always carries the four groups in order", async () => {
    const response = await listTickets(get("http://localhost/api/tickets"), {
      repository: seededRepository(),
    });
    const body = ListTicketsResponseSchema.parse(await response.json());
    expect(body.groups.map((group) => group.key)).toEqual([
      "P0",
      "P1",
      "P2",
      "UNTRIAGED",
    ]);
  });

  it("AC-4.3: group counts sum to the reported total", async () => {
    const response = await listTickets(get("http://localhost/api/tickets"), {
      repository: seededRepository(),
    });
    const body = ListTicketsResponseSchema.parse(await response.json());
    const summed = body.groups.reduce((sum, group) => sum + group.count, 0);
    expect(summed).toBe(body.total);
  });

  it("NFR-7: emits exactly one structured log line per response", async () => {
    await listTickets(get("http://localhost/api/tickets"), {
      repository: seededRepository(),
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [firstCall] = logSpy.mock.calls;
    const line: unknown = JSON.parse(String(firstCall?.[0]));
    expect(line).toMatchObject({
      msg: "http_request",
      method: "GET",
      path: "/api/tickets",
      status: 200,
    });
  });

  it("NFR-8: a repository failure becomes a 500 in the shared error envelope", async () => {
    const exploding = {
      listByStatus: (): Promise<never> => {
        return Promise.reject(new Error("db offline"));
      },
      findById: (): Promise<null> => Promise.resolve(null),
      update: (): Promise<null> => Promise.resolve(null),
    };

    const response = await listTickets(get("http://localhost/api/tickets"), {
      repository: exploding,
    });

    expect(response.status).toBe(500);
    expect(ApiErrorSchema.parse(await response.json()).error.code).toBe(
      "INTERNAL_ERROR",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* PATCH /api/tickets/:id                                                      */
/* -------------------------------------------------------------------------- */

describe("updateTicket (FR-2, FR-3, FR-5)", () => {
  it("AC-2.2: sets a priority and returns the updated ticket", async () => {
    const repository = new FakeTicketRepository([makeTicket({ id: "tkt" })]);
    const response = await updateTicket(
      patch(JSON.stringify({ priority: "P1" })),
      "tkt",
      { repository },
    );

    expect(response.status).toBe(200);
    const ticket = TicketSchema.parse(await response.json());
    expect(ticket.priority).toBe("P1");
  });

  it("AC-2.3: rejects an invalid priority, names the field, and writes nothing", async () => {
    const repository = new FakeTicketRepository([
      makeTicket({ id: "tkt", priority: "P0" }),
    ]);
    const response = await updateTicket(
      patch(JSON.stringify({ priority: "P9" })),
      "tkt",
      { repository },
    );

    expect(response.status).toBe(400);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.details?.[0]?.path).toBe("priority");
    expect(repository.updateCalls).toBe(0);
    expect(repository.all[0]?.priority).toBe("P0");
  });

  it("AC-2.4: null un-triages the ticket", async () => {
    const repository = new FakeTicketRepository([
      makeTicket({ id: "tkt", priority: "P0" }),
    ]);
    const response = await updateTicket(
      patch(JSON.stringify({ priority: null })),
      "tkt",
      { repository },
    );

    expect(response.status).toBe(200);
    expect(TicketSchema.parse(await response.json()).priority).toBeNull();
  });

  it("AC-3.2: trims the owner before storing it", async () => {
    const repository = new FakeTicketRepository([makeTicket({ id: "tkt" })]);
    const response = await updateTicket(
      patch(JSON.stringify({ owner: "  Ravi K.  " })),
      "tkt",
      { repository },
    );

    expect(TicketSchema.parse(await response.json()).owner).toBe("Ravi K.");
  });

  it("AC-3.3: an empty-string owner is a 400, but null un-assigns", async () => {
    const repository = new FakeTicketRepository([
      makeTicket({ id: "tkt", owner: "Ravi K." }),
    ]);

    const rejected = await updateTicket(
      patch(JSON.stringify({ owner: "" })),
      "tkt",
      { repository },
    );
    expect(rejected.status).toBe(400);

    const accepted = await updateTicket(
      patch(JSON.stringify({ owner: null })),
      "tkt",
      { repository },
    );
    expect(accepted.status).toBe(200);
    expect(TicketSchema.parse(await accepted.json()).owner).toBeNull();
  });

  it("AC-3.4: an over-long owner is a 400", async () => {
    const repository = new FakeTicketRepository([makeTicket({ id: "tkt" })]);
    const response = await updateTicket(
      patch(JSON.stringify({ owner: "x".repeat(121) })),
      "tkt",
      { repository },
    );

    expect(response.status).toBe(400);
    expect(repository.updateCalls).toBe(0);
  });

  it("AC-5.2: an unknown key is a 400, not a silent no-op", async () => {
    const repository = new FakeTicketRepository([makeTicket({ id: "tkt" })]);
    const response = await updateTicket(
      patch(JSON.stringify({ priority: "P0", assignee: "typo" })),
      "tkt",
      { repository },
    );

    expect(response.status).toBe(400);
    expect(repository.updateCalls).toBe(0);
  });

  it("AC-5.3: an empty body is EMPTY_PATCH", async () => {
    const repository = new FakeTicketRepository([makeTicket({ id: "tkt" })]);
    const response = await updateTicket(patch("{}"), "tkt", { repository });

    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).error.code).toBe(
      "EMPTY_PATCH",
    );
  });

  it("AC-5.4: an unknown ticket id is a 404", async () => {
    const repository = new FakeTicketRepository([]);
    const response = await updateTicket(
      patch(JSON.stringify({ priority: "P0" })),
      "does-not-exist",
      { repository },
    );

    expect(response.status).toBe(404);
    expect(ApiErrorSchema.parse(await response.json()).error.code).toBe(
      "TICKET_NOT_FOUND",
    );
  });

  it("AC-5.5: malformed JSON is a 400, never a 500", async () => {
    const repository = new FakeTicketRepository([makeTicket({ id: "tkt" })]);
    const response = await updateTicket(patch("{not json"), "tkt", {
      repository,
    });

    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).error.code).toBe(
      "INVALID_JSON",
    );
  });

  it("NFR-8: every failure path uses the same envelope", async () => {
    const repository = new FakeTicketRepository([makeTicket({ id: "tkt" })]);
    const failures = await Promise.all([
      updateTicket(patch("{oops"), "tkt", { repository }),
      updateTicket(patch("{}"), "tkt", { repository }),
      updateTicket(patch(JSON.stringify({ priority: "P9" })), "tkt", {
        repository,
      }),
      updateTicket(patch(JSON.stringify({ priority: "P0" })), "nope", {
        repository,
      }),
    ]);

    for (const response of failures) {
      expect(response.ok).toBe(false);
      expect(ApiErrorSchema.safeParse(await response.json()).success).toBe(true);
    }
  });
});
