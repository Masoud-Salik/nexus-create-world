/**
 * E5 Phase C — source-span verification.
 *
 * Pure, deterministic, no I/O. Everything the Knowledge Engine publishes must
 * point at a verbatim span of the source chunk it claims to come from; this
 * module is the only place that decides whether a quote is real.
 *
 * Matching is whitespace- and punctuation-tolerant (models re-wrap text) but
 * never fuzzy on content: the quote's characters must appear in order in the
 * chunk.
 */

export const SPAN_VERSION = "span@1";

/** Minimum quote length. Shorter quotes are not evidence, they are noise. */
export const MIN_QUOTE_CHARS = 12;
export const MAX_QUOTE_CHARS = 600;

export interface Span {
  char_start: number;
  char_end: number;
  quote: string;
}

/** Collapse whitespace while keeping a map back to original offsets. */
function collapse(text: string): { value: string; offsets: number[] } {
  const out: string[] = [];
  const offsets: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      out.push(" ");
      offsets.push(i);
      lastWasSpace = true;
      continue;
    }
    out.push(ch.toLowerCase());
    offsets.push(i);
    lastWasSpace = false;
  }
  // Drop a trailing space so offsets stay aligned with real characters.
  while (out.length && out[out.length - 1] === " ") {
    out.pop();
    offsets.pop();
  }
  return { value: out.join(""), offsets };
}

/**
 * Locate `quote` inside `chunkText`. Returns the span with offsets relative to
 * the chunk, or `null` when the quote is not verbatim.
 */
export function findSpan(chunkText: string, quote: string): Span | null {
  if (!chunkText || !quote) return null;
  const trimmed = quote.trim();
  if (trimmed.length < MIN_QUOTE_CHARS || trimmed.length > MAX_QUOTE_CHARS) return null;

  const hay = collapse(chunkText);
  const needle = collapse(trimmed);
  if (!needle.value) return null;

  const at = hay.value.indexOf(needle.value);
  if (at < 0) return null;

  const start = hay.offsets[at];
  const end = hay.offsets[at + needle.value.length - 1] + 1;
  return { char_start: start, char_end: end, quote: chunkText.slice(start, end) };
}

/** Stable content identity for a knowledge unit or candidate item. */
export async function contentHash(parts: Array<string | number | null | undefined>): Promise<string> {
  const input = parts.map((p) => String(p ?? "")).join("\u0000");
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token set used by the near-duplicate gate. */
export function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}
