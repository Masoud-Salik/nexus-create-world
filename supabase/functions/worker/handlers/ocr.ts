/**
 * E4 / M4.3 — OCR one document.
 *
 * Only pages the client flagged `needs_ocr` (no usable text layer) are sent to a
 * vision model, one page at a time, reading the rasterised PNG the client
 * uploaded next to the source file. Idempotent: a page that already has text is
 * skipped, so a reclaimed lease never double-charges or duplicates rows.
 */
import { Job, JobContext } from "../../_shared/queue.ts";
import { callModel, fenceData } from "../../_shared/ai/call.ts";
import { enqueue } from "../../_shared/queue.ts";

const MAX_PAGES = 300;

export async function ocrHandler(job: Job, ctx: JobContext): Promise<void> {
  const documentId = String(job.payload.document_id ?? "");
  if (!documentId) throw new Error("ocr: missing document_id");

  const { svc, log, traceId } = ctx;

  const { data: doc, error: docErr } = await svc
    .from("documents").select("id, user_id, storage_path, status").eq("id", documentId).maybeSingle();
  if (docErr) throw new Error(`ocr: ${docErr.message}`);
  if (!doc) return; // deleted while queued — nothing to do

  const { data: pages, error: pagesErr } = await svc
    .from("document_pages")
    .select("id, page_no, text, needs_ocr")
    .eq("document_id", documentId)
    .eq("needs_ocr", true)
    .order("page_no")
    .limit(MAX_PAGES);
  if (pagesErr) throw new Error(`ocr: ${pagesErr.message}`);

  const pending = (pages ?? []).filter((p: any) => !p.text || p.text.trim().length === 0);

  if (pending.length) {
    await svc.from("documents").update({ status: "ocr" }).eq("id", documentId);
  }

  for (const page of pending) {
    const objectPath = `${doc.user_id}/${documentId}/page-${page.page_no}.png`;
    const { data: signed } = await svc.storage
      .from("user-documents").createSignedUrl(objectPath, 300);
    if (!signed?.signedUrl) {
      log.warn("ocr.page_image_missing", { document_id: documentId, page_no: page.page_no });
      await svc.from("document_pages")
        .update({ needs_ocr: false, ocr_confidence: 0 }).eq("id", page.id);
      continue;
    }

    const result = await callModel(
      "ocr_page",
      {
        messages: [
          {
            role: "system",
            content:
              "You transcribe scanned study material. Return ONLY the text visible in the image, " +
              "preserving reading order, headings and list structure. No commentary, no markdown fences. " +
              "If the page is blank or unreadable, return an empty string.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: fenceData("page_context", `page ${page.page_no}`) },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
      },
      { supabase: svc, ownerId: doc.user_id, traceId, log },
    );

    const text = (result.text ?? "").trim();
    await svc.from("document_pages").update({
      text,
      needs_ocr: false,
      ocr_confidence: text.length > 20 ? 0.9 : 0.2,
    }).eq("id", page.id);
  }

  const { count } = await svc
    .from("document_pages")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId)
    .neq("text", "");
  await svc.from("documents").update({ pages_extracted: count ?? 0 }).eq("id", documentId);

  await enqueue(svc, "chunk", {
    key: `chunk:${documentId}`,
    payload: { document_id: documentId },
    traceId,
  });
  log.info("ocr.done", { document_id: documentId, pages: pending.length });
}