import { describe, expect, it } from "vitest";
import {
  ApiErrorSchema,
  ListQuerySchema,
  OWNER_MAX_LENGTH,
  UpdateTicketSchema,
  toErrorDetails,
} from "@/lib/contracts";

describe("ListQuerySchema (FR-1)", () => {
  it("AC-1.2: defaults to OPEN when no status is supplied", () => {
    const parsed = ListQuerySchema.parse({});
    expect(parsed.status).toBe("OPEN");
  });

  it("AC-1.3: accepts an explicit CLOSED status", () => {
    expect(ListQuerySchema.parse({ status: "CLOSED" }).status).toBe("CLOSED");
  });

  it("AC-1.4: rejects a status outside the enum", () => {
    expect(ListQuerySchema.safeParse({ status: "BANANA" }).success).toBe(false);
  });
});

describe("UpdateTicketSchema (FR-2, FR-3, FR-5)", () => {
  it("AC-2.2: accepts a valid priority", () => {
    expect(UpdateTicketSchema.parse({ priority: "P1" })).toEqual({
      priority: "P1",
    });
  });

  it("AC-2.3: rejects a priority outside P0/P1/P2 and names the field", () => {
    const result = UpdateTicketSchema.safeParse({ priority: "P9" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toErrorDetails(result.error)[0]?.path).toBe("priority");
  });

  it("AC-2.4: accepts null as a deliberate un-triage", () => {
    expect(UpdateTicketSchema.parse({ priority: null })).toEqual({
      priority: null,
    });
  });

  it("AC-3.2: trims surrounding whitespace from owner", () => {
    expect(UpdateTicketSchema.parse({ owner: "  Ravi K.  " })).toEqual({
      owner: "Ravi K.",
    });
  });

  it("AC-3.3: rejects an empty-string owner — null is how you un-assign", () => {
    expect(UpdateTicketSchema.safeParse({ owner: "" }).success).toBe(false);
    expect(UpdateTicketSchema.safeParse({ owner: "   " }).success).toBe(false);
    expect(UpdateTicketSchema.safeParse({ owner: null }).success).toBe(true);
  });

  it("AC-3.4: rejects an owner longer than the documented maximum", () => {
    const tooLong = "x".repeat(OWNER_MAX_LENGTH + 1);
    expect(UpdateTicketSchema.safeParse({ owner: tooLong }).success).toBe(false);
    expect(
      UpdateTicketSchema.safeParse({ owner: "x".repeat(OWNER_MAX_LENGTH) })
        .success,
    ).toBe(true);
  });

  it("AC-5.2: rejects unknown keys rather than silently dropping them", () => {
    const result = UpdateTicketSchema.safeParse({
      priority: "P0",
      assignee: "typo for owner",
    });
    expect(result.success).toBe(false);
  });

  it("AC-5.3: an empty patch parses, so the route can report EMPTY_PATCH", () => {
    const result = UpdateTicketSchema.safeParse({});
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.keys(result.data)).toHaveLength(0);
  });
});

describe("ApiErrorSchema (NFR-8)", () => {
  it("accepts the documented envelope with and without details", () => {
    expect(
      ApiErrorSchema.safeParse({
        error: { code: "EMPTY_PATCH", message: "nothing to change" },
      }).success,
    ).toBe(true);

    expect(
      ApiErrorSchema.safeParse({
        error: {
          code: "INVALID_BODY",
          message: "bad",
          details: [{ path: "priority", message: "nope" }],
        },
      }).success,
    ).toBe(true);
  });

  it("rejects an error code that is not in the documented set", () => {
    expect(
      ApiErrorSchema.safeParse({
        error: { code: "KABOOM", message: "bad" },
      }).success,
    ).toBe(false);
  });
});
