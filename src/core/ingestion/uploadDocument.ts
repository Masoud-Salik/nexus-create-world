/**
 * E4 / M4.1 + M4.2 — the upload pipeline.
 *
 * Order matters: fingerprint → documents row → original file → extracted pages →
 * page images → enqueue. If any step fails, the row is marked failed so the
 * Library can offer a retry instead of leaving a silent orphan.
 */
import { supabase } from "@/integrations/supabase/client";
import { ACCEPTED_MIME, MAX_BYTES, extractFile, sha256Hex } from "./extract";

export const BUCKET = "user-documents";

/** The server owns the real limits; surface its message verbatim. */
async function invokeIngest(body: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke("ingest", { body });
  if (!error) return;
  let message = error.message;
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.text === "function") {
    try {
      const parsed = JSON.parse(await ctx.text());
      if (parsed?.message) message = parsed.message;
    } catch {
      // keep the generic message
    }
  }
  throw new Error(message);
}

export type UploadPhase = "hashing" | "extracting" | "uploading" | "queued";

export interface UploadProgress {
  phase: UploadPhase;
  done: number;
  total: number;
}

export class DuplicateDocumentError extends Error {
  constructor() {
    super("You've already uploaded this file.");
    this.name = "DuplicateDocumentError";
  }
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_BYTES) return "That file is larger than 25 MB.";
  const okMime = ACCEPTED_MIME.includes(file.type) || /\.(pdf|txt|md|markdown|png|jpe?g|webp)$/i.test(file.name);
  if (!okMime) return "Supported files: PDF, image, .txt or .md.";
  return null;
}

export async function uploadDocument(
  file: File,
  userId: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);

  onProgress?.({ phase: "hashing", done: 0, total: 1 });
  const sha256 = await sha256Hex(file);

  onProgress?.({ phase: "extracting", done: 0, total: 1 });
  const { pages, pageCount } = await extractFile(file, (done, total) =>
    onProgress?.({ phase: "extracting", done, total }),
  );

  // Quota + size gate before anything is written, so a rejected upload leaves
  // no row and no storage object behind.
  await invokeIngest({
    action: "preflight",
    bytes: file.size,
    page_count: pageCount,
    ocr_pages: pages.filter((p) => p.needs_ocr).length,
  });

  const title = file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Untitled";
  const { data: doc, error: insertErr } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      title,
      mime: file.type || "application/octet-stream",
      bytes: file.size,
      storage_path: "",
      sha256,
      page_count: pageCount,
    })
    .select("id")
    .single();

  if (insertErr || !doc) {
    if (insertErr?.code === "23505") throw new DuplicateDocumentError();
    throw new Error(insertErr?.message ?? "Could not create the document.");
  }

  const documentId = doc.id;
  const storagePath = `${userId}/${documentId}/source`;

  try {
    onProgress?.({ phase: "uploading", done: 0, total: pages.length + 1 });
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type || undefined, upsert: true });
    if (upErr) throw new Error(upErr.message);

    await supabase.from("documents").update({ storage_path: storagePath }).eq("id", documentId);

    const rows = pages.map((p) => ({
      document_id: documentId,
      user_id: userId,
      page_no: p.page_no,
      text: p.text,
      has_text_layer: p.has_text_layer,
      needs_ocr: p.needs_ocr,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase
        .from("document_pages")
        .upsert(rows.slice(i, i + 200), { onConflict: "document_id,page_no" });
      if (error) throw new Error(error.message);
    }

    let uploaded = 1;
    for (const page of pages) {
      if (!page.image) continue;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(`${userId}/${documentId}/page-${page.page_no}.png`, page.image, {
          contentType: "image/png",
          upsert: true,
        });
      if (error) throw new Error(error.message);
      uploaded++;
      onProgress?.({ phase: "uploading", done: uploaded, total: pages.length + 1 });
    }

    await supabase.from("documents").update({
      pages_extracted: pages.filter((p) => p.text.length > 0).length,
    }).eq("id", documentId);

    await invokeIngest({ action: "process", document_id: documentId });

    onProgress?.({ phase: "queued", done: 1, total: 1 });
    return documentId;
  } catch (err) {
    // Pipeline state is backend-owned (E5 Phase D): the client reports the
    // failure, the control plane records it.
    await invokeIngest({
      action: "fail",
      document_id: documentId,
      reason: err instanceof Error ? err.message.slice(0, 300) : "Upload failed.",
    }).catch(() => undefined);
    throw err;
  }
}

export async function retryDocument(documentId: string): Promise<void> {
  await invokeIngest({ action: "retry", document_id: documentId });
}

/**
 * `list` returns at most 100 objects by default, so a scanned document with
 * hundreds of page images would leak storage. Page through the whole prefix.
 */
export async function listDocumentObjects(documentId: string, userId: string): Promise<string[]> {
  const prefix = `${userId}/${documentId}`;
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error || !data?.length) break;
    paths.push(...data.map((f) => `${prefix}/${f.name}`));
    if (data.length < 1000) break;
  }
  return paths;
}

export async function deleteDocument(documentId: string, userId: string): Promise<void> {
  const paths = await listDocumentObjects(documentId, userId);
  for (let i = 0; i < paths.length; i += 500) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
}