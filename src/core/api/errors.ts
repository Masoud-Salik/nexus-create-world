/**
 * E1 / M1.5 — the client half of the canonical error envelope.
 */

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "rate_limited"
  | "quota_exceeded"
  | "internal"
  | "network";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly traceId?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Copy that is safe and useful to show a user, per error code. */
export function userMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (err.code) {
    case "unauthorized":
      return "Please sign in to continue.";
    case "forbidden":
      return "You do not have access to that.";
    case "not_found":
      return "That item no longer exists.";
    case "validation_failed":
      return err.message;
    case "conflict":
      return "That already happened — nothing was changed.";
    case "rate_limited":
      return "You are going a bit fast. Try again in a moment.";
    case "quota_exceeded":
      return "You have reached your usage limit for now.";
    case "network":
      return "You appear to be offline. We will retry automatically.";
    default:
      return "Something went wrong on our side. We have logged it.";
  }
}