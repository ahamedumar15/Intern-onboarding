import { describe, expect, it } from "vitest";
import { buildRequestLog } from "@/lib/logger";

const BASE = {
  requestId: "req-1",
  method: "GET",
  path: "/api/tickets",
  durationMs: 12,
};

describe("buildRequestLog (NFR-7)", () => {
  it("carries requestId, method, path, status and durationMs on every line", () => {
    const line = buildRequestLog({ ...BASE, status: 200 });
    expect(line).toMatchObject({
      msg: "http_request",
      requestId: "req-1",
      method: "GET",
      path: "/api/tickets",
      status: 200,
      durationMs: 12,
    });
  });

  it("is serialisable as a single JSON line", () => {
    const serialised = JSON.stringify(buildRequestLog({ ...BASE, status: 200 }));
    expect(serialised).not.toContain("\n");
    expect(JSON.parse(serialised)).toHaveProperty("requestId", "req-1");
  });

  it("levels by status: 2xx info, 4xx warn, 5xx error", () => {
    expect(buildRequestLog({ ...BASE, status: 200 }).level).toBe("info");
    expect(buildRequestLog({ ...BASE, status: 404 }).level).toBe("warn");
    expect(buildRequestLog({ ...BASE, status: 500 }).level).toBe("error");
  });

  it("every 5xx carries an errorName, even when the caller forgot one", () => {
    expect(buildRequestLog({ ...BASE, status: 500 }).errorName).toBe(
      "UnknownError",
    );
    expect(
      buildRequestLog({ ...BASE, status: 500, errorName: "PrismaClientError" })
        .errorName,
    ).toBe("PrismaClientError");
  });

  it("does not invent an errorName on a successful response", () => {
    expect(buildRequestLog({ ...BASE, status: 200 }).errorName).toBeUndefined();
  });
});
