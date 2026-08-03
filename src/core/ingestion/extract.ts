/**
 * E4 / M4.2 — client-side extraction.
 *
 * Born-digital PDFs never touch a model: pdf.js reads the text layer in the
 * browser, so ingestion costs nothing but bandwidth. Pages with no usable text
 * layer are rasterised to PNG and flagged for server OCR (M4.3).
 */
import * as pdfjs from "pdfjs-dist";

// Vite resolves the worker as a real module URL; without this pdf.js falls back
// to running on the main thread and freezes the UI on large files.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_PAGES = 300;
export const ACCEPTED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown"];

/** A page needs OCR when the text layer yields almost nothing. */
const MIN_TEXT_LAYER_CHARS = 40;
const OCR_RENDER_SCALE = 2;

export interface ExtractedPage {
  page_no: number;
  text: string;
  has_text_layer: boolean;
  needs_ocr: boolean;
  /** PNG of the page, present only when `needs_ocr`. */
  image?: Blob;
}

export interface ExtractResult {
  pages: ExtractedPage[];
  pageCount: number;
}

export async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function renderPageToPng(page: any): Promise<Blob | undefined> {
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return await new Promise<Blob | undefined>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? undefined), "image/png", 0.9),
  );
}

export async function extractPdf(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  if (pageCount > MAX_PAGES) {
    throw new Error(`This PDF has ${pageCount} pages. The limit is ${MAX_PAGES}.`);
  }

  const pages: ExtractedPage[] = [];
  for (let n = 1; n <= pageCount; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str?: string }>)
      .map((i) => i.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const hasTextLayer = text.length >= MIN_TEXT_LAYER_CHARS;
    const entry: ExtractedPage = {
      page_no: n,
      text: hasTextLayer ? text : "",
      has_text_layer: hasTextLayer,
      needs_ocr: !hasTextLayer,
    };
    if (!hasTextLayer) entry.image = await renderPageToPng(page);
    pages.push(entry);
    page.cleanup();
    onProgress?.(n, pageCount);
  }

  await doc.destroy();
  return { pages, pageCount };
}

/** Images are always OCR'd; plain text needs no extraction at all. */
export async function extractNonPdf(file: File): Promise<ExtractResult> {
  if (file.type.startsWith("image/")) {
    return {
      pageCount: 1,
      pages: [{ page_no: 1, text: "", has_text_layer: false, needs_ocr: true, image: file }],
    };
  }
  const text = (await file.text()).trim();
  return {
    pageCount: 1,
    pages: [{ page_no: 1, text, has_text_layer: text.length > 0, needs_ocr: text.length === 0 }],
  };
}

export async function extractFile(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractResult> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return extractPdf(file, onProgress);
  }
  return extractNonPdf(file);
}