/**
 * E5.1 / M5.1b — generate study items from a document's chunks.
 *
 * Idempotent: items are deduplicated by (user_id, item_hash) where item_hash is
 * a SHA-256 of the normalized question text. A reclaimed lease resumes by
 * skipping chunks that already have items linked to them.
 */
import { Job, JobContext } from "../../_shared/queue.ts";
import { callModel, fenceData } from "../../_shared/ai/call.ts";

const CHUNKS_PER_BATCH = 6;

interface StudyItemInput {
  type: "flashcard" | "mcq" | "true_false" | "fill_blank" | "short_answer";
  question: string;
  answer?: string | null;
  options?: Array<{ text: string; is_correct: boolean }> | null;
  correct_answer?: string | null;
  explanation?: string | null;
  difficulty: "easy" | "medium" | "hard";
  chunk_index?: number | null;
}

interface StudyItemsResult {
  items: StudyItemInput[];
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeQuestion(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 1000);
}

const SYSTEM_PROMPT =
  "You are a study-item generator. Given chunks of a document, create study items " +
  "that help a learner rehearse the material. Produce a mix of flashcards, " +
  "multiple-choice questions (mcq), true/false, fill-in-the-blank, and short-answer items. " +
  "Every item must be directly answerable from the provided text — do not invent facts. " +
  "For each item, set chunk_index to the 0-based index of the chunk it draws from. " +
  "Return JSON matching the schema: { \"items\": [{ type, question, answer, options, " +
  "correct_answer, explanation, difficulty, chunk_index }] }. " +
  "Flashcards: set answer to the back of the card. MCQ: set options to an array of " +
  "{text, is_correct} with exactly one correct. True/false: set correct_answer to " +
  "\"true\" or \"false\". Fill-blank: set correct_answer to the missing word/phrase. " +
  "Short-answer: set answer to a concise model answer. Always include an explanation.";

export async function generateItemsHandler(job: Job, ctx: JobContext): Promise<void> {
  const documentId = String(job.payload.document_id ?? "");
  if (!documentId) throw new Error("generate_items: missing document_id");
  const { svc, log, traceId } = ctx;

  const { data: doc, error: docErr } = await svc
    .from("documents")
    .select("id, user_id, title")
    .eq("id", documentId)
    .maybeSingle();
  if (docErr) throw new Error(`generate_items: ${docErr.message}`);
  if (!doc) return;

  const { data: chunks, error: chunksErr } = await svc
    .from("document_chunks")
    .select("id, chunk_index, content, page_no")
    .eq("document_id", documentId)
    .order("chunk_index");
  if (chunksErr) throw new Error(`generate_items: ${chunksErr.message}`);

  if (!chunks || chunks.length === 0) {
    await svc.from("documents")
      .update({ generation_status: "skipped" })
      .eq("id", documentId);
    log.info("generate_items.empty", { document_id: documentId });
    return;
  }

  await svc.from("documents")
    .update({ generation_status: "generating" })
    .eq("id", documentId);

  const aiCtx = { supabase: svc, ownerId: doc.user_id, traceId, log };

  const { data: existing } = await svc
    .from("study_items")
    .select("chunk_id")
    .eq("document_id", documentId);
  const processedChunkIds = new Set((existing ?? []).map((r: any) => r.chunk_id));

  const pending = chunks.filter((c: any) => !processedChunkIds.has(c.id));

  if (pending.length === 0) {
    await svc.from("documents")
      .update({ generation_status: "ready" })
      .eq("id", documentId);
    log.info("generate_items.already_done", { document_id: documentId });
    return;
  }

  let totalInserted = 0;

  for (let i = 0; i < pending.length; i += CHUNKS_PER_BATCH) {
    const batch = pending.slice(i, i + CHUNKS_PER_BATCH);

    const chunkContext = batch.map((c: any, idx: number) =>
      fenceData(`chunk_${idx}_index_${c.chunk_index}_page_${c.page_no ?? "n/a"}`, c.content, 4000),
    ).join("\n\n");

    const userContent =
      `Document title: ${doc.title}\n\n` +
      `Below are ${batch.length} chunks from this document. Generate study items ` +
      `from them. Each item must cite its source chunk via chunk_index (0-based ` +
      `within this batch).\n\n${chunkContext}`;

    let result;
    try {
      result = await callModel<StudyItemsResult>(
        "generate_items",
        {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          schemaKey: "study_items",
        },
        aiCtx,
      );
    } catch (e) {
      log.warn("generate_items.batch_failed", {
        document_id: documentId,
        batch_start: i,
        detail: String(e),
      });
      throw e;
    }

    const items = result.parsed?.items ?? [];
    if (!items.length) {
      log.warn("generate_items.no_items", { document_id: documentId, batch_start: i });
      continue;
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const item of items) {
      const chunkIdx = typeof item.chunk_index === "number" && item.chunk_index >= 0 && item.chunk_index < batch.length
        ? item.chunk_index
        : 0;
      const sourceChunk = batch[chunkIdx];
      const hash = await sha256Hex(normalizeQuestion(item.question));

      rows.push({
        document_id: documentId,
        user_id: doc.user_id,
        chunk_id: sourceChunk?.id ?? null,
        type: item.type,
        question: item.question,
        answer: item.answer ?? null,
        options: item.options ?? null,
        correct_answer: item.correct_answer ?? null,
        explanation: item.explanation ?? null,
        difficulty: item.difficulty,
        page_no: sourceChunk?.page_no ?? null,
        item_hash: hash,
      });
    }

    if (rows.length > 0) {
      const { error: insertErr } = await svc.from("study_items")
        .upsert(rows, { onConflict: "user_id,item_hash", ignoreDuplicates: true });
      if (insertErr) {
        throw new Error(`generate_items: insert failed: ${insertErr.message}`);
      }
      totalInserted += rows.length;
    }
  }

  await svc.from("documents")
    .update({ generation_status: "ready" })
    .eq("id", documentId);

  log.info("generate_items.done", {
    document_id: documentId,
    items_inserted: totalInserted,
  });
}
