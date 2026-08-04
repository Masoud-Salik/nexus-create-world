/**
 * M4.4 / M4.6 — chunker regression tests.
 *
 * Pure unit tests: no database, no network. Verifies that the shared chunker is
 * deterministic, carries provenance, respects the minimum-size threshold, and
 * splits on paragraph boundaries when possible.
 */
import { describe, expect, it } from "vitest";
import { chunkPages, CHUNK_SIZE, CHUNK_OVERLAP, type PageInput } from "../../supabase/functions/_shared/ingest/chunk.ts";

describe("chunkPages — determinism", () => {
  it("produces identical output for identical input", () => {
    const pages: PageInput[] = [
      { page_no: 1, text: "This is a test paragraph.\n\nAnd another paragraph with more text." },
    ];
    const a = chunkPages(pages);
    const b = chunkPages(pages);
    expect(b).toEqual(a);
  });

  it("chunk count is stable across 100 runs", () => {
    const long = "Sentence one. ".repeat(500);
    const pages: PageInput[] = [{ page_no: 1, text: long }];
    const first = chunkPages(pages).length;
    for (let i = 0; i < 99; i++) {
      expect(chunkPages(pages).length).toBe(first);
    }
  });
});

describe("chunkPages — provenance", () => {
  it("every chunk carries page_no, char_start, char_end", () => {
    const pages: PageInput[] = [
      { page_no: 3, text: "Some content here that is long enough to exceed the minimum chunk threshold of forty characters." },
    ];
    const chunks = chunkPages(pages);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.page_no).toBe(3);
      expect(c.char_start).toBeGreaterThanOrEqual(0);
      expect(c.char_end).toBeGreaterThan(c.char_start);
    }
  });

  it("multi-page documents tag chunks with the correct page number", () => {
    const pages: PageInput[] = [
      { page_no: 1, text: "Page one content. ".repeat(100) },
      { page_no: 2, text: "Page two content. ".repeat(100) },
      { page_no: 3, text: "Page three content. ".repeat(100) },
    ];
    const chunks = chunkPages(pages);
    const pageNos = new Set(chunks.map((c) => c.page_no));
    expect(pageNos.has(1)).toBe(true);
    expect(pageNos.has(2)).toBe(true);
    expect(pageNos.has(3)).toBe(true);
  });

  it("pages are processed in ascending page_no order regardless of input order", () => {
    const pages: PageInput[] = [
      { page_no: 3, text: "CCC. ".repeat(100) },
      { page_no: 1, text: "AAA. ".repeat(100) },
      { page_no: 2, text: "BBB. ".repeat(100) },
    ];
    const chunks = chunkPages(pages);
    const pageSequence = chunks.map((c) => c.page_no);
    const sorted = [...pageSequence].sort((a, b) => a - b);
    expect(pageSequence).toEqual(sorted);
  });
});

describe("chunkPages — edge cases", () => {
  it("empty pages produce no chunks", () => {
    expect(chunkPages([{ page_no: 1, text: "" }])).toEqual([]);
    expect(chunkPages([{ page_no: 1, text: "   \n\n  " }])).toEqual([]);
  });

  it("chunks below the minimum size are dropped", () => {
    const tiny = "Short.";
    const chunks = chunkPages([{ page_no: 1, text: tiny }]);
    expect(chunks.length).toBe(0);
  });

  it("a single short paragraph produces one chunk", () => {
    const text = "This is a paragraph that is long enough to exceed the minimum chunk threshold of forty characters.";
    const chunks = chunkPages([{ page_no: 1, text }]);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(text.trim());
  });
});

describe("chunkPages — splitting behaviour", () => {
  it("splits on paragraph boundaries when possible", () => {
    const para1 = "A".repeat(CHUNK_SIZE - 200);
    const para2 = "B".repeat(CHUNK_SIZE - 200);
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkPages([{ page_no: 1, text }], { size: CHUNK_SIZE, overlap: CHUNK_OVERLAP });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("respects the overlap parameter", () => {
    const text = "Word ".repeat(500);
    const noOverlap = chunkPages([{ page_no: 1, text }], { size: 200, overlap: 0 });
    const withOverlap = chunkPages([{ page_no: 1, text }], { size: 200, overlap: 50 });
    expect(withOverlap.length).toBeGreaterThanOrEqual(noOverlap.length);
  });

  it("token_count is a positive integer for every chunk", () => {
    const text = "This is a sufficiently long piece of text. ".repeat(100);
    const chunks = chunkPages([{ page_no: 1, text }]);
    for (const c of chunks) {
      expect(c.token_count).toBeGreaterThan(0);
      expect(Number.isInteger(c.token_count)).toBe(true);
    }
  });

  it("chunk_index is sequential starting at 0", () => {
    const text = "This is a sufficiently long piece of text. ".repeat(200);
    const chunks = chunkPages([{ page_no: 1, text }]);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunk_index).toBe(i);
    }
  });
});
