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
      status: "extracting",
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

    const { error: fnErr } = await supabase.functions.invoke("ingest", {
      body: { action: "process", document_id: documentId },
    });
    if (fnErr) throw new Error(fnErr.message);

    onProgress?.({ phase: "queued", done: 1, total: 1 });
    return documentId;
  } catch (err) {
    await supabase.from("documents").update({
      status: "failed",
      error: err instanceof Error ? err.message.slice(0, 300) : "Upload failed.",
    }).eq("id", documentId);
    throw err;
  }
}

export async function retryDocument(documentId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("ingest", {
    body: { action: "retry", document_id: documentId },
  });
  if (error) throw new Error(error.message);
}

export async function deleteDocument(documentId: string, userId: string): Promise<void> {
  const prefix = `${userId}/${documentId}`;
  const { data: files } = await supabase.storage.from(BUCKET).list(prefix);
  if (files?.length) {
    await supabase.storage.from(BUCKET).remove(files.map((f) => `${prefix}/${f.name}`));
  }
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
}