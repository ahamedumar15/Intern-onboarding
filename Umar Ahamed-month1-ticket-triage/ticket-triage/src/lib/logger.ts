/**
 * NFR-7 — every API response emits exactly one structured JSON line carrying
 * requestId, method, path, status and durationMs; every 5xx additionally
 * carries errorName.
 *
 * `buildRequestLog` is separated from `logRequest` so the shape can be asserted
 * in `tests/logger.test.ts` without capturing stdout.
 */

export type RequestLogFields = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  errorName?: string;
};

export type RequestLogLine = {
  level: "info" | "warn" | "error";
  msg: "http_request";
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  errorName?: string;
};

function levelFor(status: number): RequestLogLine["level"] {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

/**
 * Builds the log record. A 5xx without an explicit `errorName` still gets one —
 * a server error with no name is an unobservable server error, and NFR-7 says
 * 100% of them carry it.
 */
export function buildRequestLog(fields: RequestLogFields): RequestLogLine {
  const level = levelFor(fields.status);
  const line: RequestLogLine = {
    level,
    msg: "http_request",
    requestId: fields.requestId,
    method: fields.method,
    path: fields.path,
    status: fields.status,
    durationMs: fields.durationMs,
  };

  if (fields.errorName !== undefined) {
    line.errorName = fields.errorName;
  } else if (level === "error") {
    line.errorName = "UnknownError";
  }

  return line;
}

export function logRequest(fields: RequestLogFields): void {
  console.log(JSON.stringify(buildRequestLog(fields)));
}

export function newRequestId(): string {
  return globalThis.crypto.randomUUID();
}
