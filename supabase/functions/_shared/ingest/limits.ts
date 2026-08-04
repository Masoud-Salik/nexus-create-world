/**
 * E4 hardening — one place for every ingestion limit.
 *
 * These are deliberately centralised (and read as plain constants) so a future
 * plan tier can swap them per user without touching the pipeline.
 */
export interface IngestLimits {
  /** Largest single upload. */
  maxBytes: number;
  /** Pages per document. */
  maxPages: number;
  /** Pages we are willing to send to a vision model for one document. */
  maxOcrPages: number;
  /** Documents a user may keep in the Library. */
  maxDocuments: number;
  /** Total stored bytes across all of a user's documents. */
  maxStorageBytes: number;
  /** How many times one document may be reprocessed before we stop. */
  maxRetries: number;
}

export const FREE_LIMITS: IngestLimits = {
  maxBytes: 25 * 1024 * 1024,
  maxPages: 300,
  maxOcrPages: 60,
  maxDocuments: 200,
  maxStorageBytes: 500 * 1024 * 1024,
  maxRetries: 3,
};

/** Single lookup point — plan-aware later, constant for now. */
export function limitsFor(_userId: string): IngestLimits {
  return FREE_LIMITS;
}

export function humanBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(0)} MB`;
}