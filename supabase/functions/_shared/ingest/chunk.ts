/**
 * E4 / M4.4 — the single chunker.
 *
 * Chunks carry provenance (`page_no`, `char_start`, `char_end`) because E5 item
 * generation and E7 evidence must cite the exact source span. Pure and
 * deterministic: the same page text always yields the same chunks, which is
 * what makes the `chunk` job idempotent.
 */

export interface PageInput {
  page_no: number;
  text: string;
}

export interface Chunk {
  chunk_index: number;
  content: string;
  page_no: number;
  char_start: number;
  char_end: number;
  token_count: number;
}

export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 150;
const MIN_CHUNK = 40;

function normalise(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Split one page. Offsets are relative to the normalised page text. */
function chunkPage(text: string, size: number, overlap: number): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  if (text.length <= size) return text.length ? [{ start: 0, end: text.length }] : [];

  let i = 0;
  while (i < text.length) {
    const hardEnd = Math.min(i + size, text.length);
    let cut = hardEnd;
    if (hardEnd < text.length) {
      const tail = text.slice(i, hardEnd);
      const para = tail.lastIndexOf("\n\n");
      const sent = Math.max(tail.lastIndexOf(". "), tail.lastIndexOf("? "), tail.lastIndexOf("! "));
      if (para > size * 0.5) cut = i + para;
      else if (sent > size * 0.5) cut = i + sent + 1;
    }
    spans.push({ start: i, end: cut });
    if (cut >= text.length) break;
    i = Math.max(cut - overlap, i + 1);
  }
  return spans;
}

export function chunkPages(
  pages: PageInput[],
  opts: { size?: number; overlap?: number } = {},
): Chunk[] {
  const size = opts.size ?? CHUNK_SIZE;
  const overlap = opts.overlap ?? CHUNK_OVERLAP;
  const out: Chunk[] = [];

  for (const page of [...pages].sort((a, b) => a.page_no - b.page_no)) {
    const text = normalise(page.text ?? "");
    if (!text) continue;
    for (const span of chunkPage(text, size, overlap)) {
      const content = text.slice(span.start, span.end).trim();
      if (content.length < MIN_CHUNK) continue;
      out.push({
        chunk_index: out.length,
        content,
        page_no: page.page_no,
        char_start: span.start,
        char_end: span.end,
        token_count: Math.ceil(content.length / 4),
      });
    }
  }
  return out;
}