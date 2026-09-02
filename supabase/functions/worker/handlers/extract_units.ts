/**
 * E5 Phase C — bounded knowledge-unit extraction.
 *
 * Runs once per source version, over a bounded sample of chunks (never the
 * whole document). The model proposes units; deterministic code verifies that
 * every unit quotes its chunk verbatim before anything is written. Unverified
 * units are dropped, not stored.
 *
 * Idempotent: units are keyed by (owner_id, content_hash), so a reclaimed lease
 * re-inserts nothing.
 */
import { Job, JobContext } from "../../_shared/queue.ts";
import { callModel } from "../../_shared/ai/call.ts";
import { fenceData } from "../../_shared/ai/untrusted.ts";
import { contentHash, findSpan } from "../../_shared/knowledge/units.ts";
import { requestGeneration, STARTER_MAX } from "../../_shared/knowledge/inventory.ts";
import { enqueue } from "../../_shared/queue.ts";
import { emitEvent } from "../../_shared/knowledge/events.ts";

/** Bounded sample: cost per source must not scale with document length. */
const MAX_CHUNKS = 12;
const MAX_CHARS_PER_CHUNK = 1400;

const SYSTEM = [
  "You extract atomic knowledge units from study material.",
  "A unit is one self-contained, testable statement.",
  "Every unit MUST include `quote`: a VERBATIM substring copied from the numbered chunk you cite.",
  "Never paraphrase inside `quote`. Never invent content that is not in the text.",
  "Return JSON: {\"units\":[{\"statement\",\"kind\",\"quote\",\"chunk_index\",\"importance\"}]}",
].join(" ");

/** Evenly spaced sample so a long document is still represented end to end. */
function sample<T>(rows: T[], max: number): T[] {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  return Array.from({ length: max }, (_, i) => rows[Math.floor(i * step)]);
}

export async function extractUnitsHandler(job: Job, ctx: JobContext): Promise<void> {
  const documentId = String(job.payload.document_id ?? "");
  if (!documentId) throw new Error("extract_units: missing document_id");
  const { svc, log, traceId } = ctx;

  const { data: doc, error: docErr } = await svc
    .from("documents").select("id, user_id, title, status").eq("id", documentId).maybeSingle();
  if (docErr) throw new Error(`extract_units: ${docErr.message}`);
  if (!doc || doc.status !== "ready") return;

  const { count: existing } = await svc.from("knowledge_units")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", doc.user_id).eq("document_id", documentId);

  if ((existing ?? 0) > 0) {
    log.info("extract_units.skipped", { document_id: documentId, existing });
  } else {
    const { data: chunks, error: chunkErr } = await svc
      .from("document_chunks")
      .select("id, chunk_index, content, page_no")
      .eq("document_id", documentId)
      .order("chunk_index");
    if (chunkErr) throw new Error(`extract_units: ${chunkErr.message}`);
    if (!chunks || chunks.length === 0) return;

    const selected = sample(chunks, MAX_CHUNKS);
    const corpus = selected
      .map((c: any) => `[chunk ${c.chunk_index}]\n${String(c.content).slice(0, MAX_CHARS_PER_CHUNK)}`)
      .join("\n\n");

    const result = await callModel<{ units: any[] }>("extract_units", {
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: fenceData(
            `Document: ${doc.title}\nExtract up to 20 high-value units.\n\n${corpus}`,
          ),
        },
      ],
      schemaKey: "knowledge_units",
      cacheInput: { documentId, chunks: selected.map((c: any) => c.chunk_index) },
    }, { supabase: svc, ownerId: doc.user_id, traceId, log });

    const byIndex = new Map<number, any>(selected.map((c: any) => [c.chunk_index, c]));
    let stored = 0;
    let dropped = 0;

    for (const unit of result.parsed?.units ?? []) {
      const chunk = byIndex.get(Number(unit.chunk_index));
      if (!chunk) { dropped++; continue; }
      const span = findSpan(String(chunk.content), String(unit.quote ?? ""));
      if (!span) { dropped++; continue; }

      const hash = await contentHash([doc.user_id, documentId, unit.statement]);
      const { data: row, error: insErr } = await svc.from("knowledge_units").upsert({
        owner_id: doc.user_id,
        document_id: documentId,
        source_version: 1,
        kind: unit.kind,
        statement: String(unit.statement).slice(0, 600),
        lifecycle: "grounded",
        content_hash: hash,
      }, { onConflict: "owner_id,content_hash", ignoreDuplicates: true })
        .select("id").maybeSingle();
      if (insErr) throw new Error(`extract_units: ${insErr.message}`);
      if (!row) continue; // already present from an earlier attempt

      const { error: spanErr } = await svc.from("knowledge_unit_spans").insert({
        knowledge_unit_id: row.id,
        owner_id: doc.user_id,
        chunk_id: chunk.id,
        document_id: documentId,
        page_no: chunk.page_no,
        char_start: span.char_start,
        char_end: span.char_end,
        quote: span.quote,
      });
      if (spanErr) throw new Error(`extract_units: ${spanErr.message}`);
      stored++;
    }

    log.info("extract_units.done", { document_id: documentId, stored, dropped });
    if (stored === 0) return;
  }

  // Starter inventory: one bounded batch, refused by policy if already capped.
  const outcome = await requestGeneration(svc, {
    ownerId: doc.user_id,
    documentId,
    reason: "starter",
    requestedCount: STARTER_MAX,
  });
  if (!outcome.requestId) {
    log.info("extract_units.generation_refused", { document_id: documentId, blocked: outcome.blocked });
    return;
  }

  await emitEvent(svc, "knowledge.inventory_requested", {
    aggregateType: "document",
    aggregateId: documentId,
    ownerId: doc.user_id,
    payload: { request_id: outcome.requestId, reason: "starter" },
    traceId,
  });

  await enqueue(svc, "generate_candidates", {
    key: `generate_candidates:${outcome.requestId}`,
    payload: { request_id: outcome.requestId },
    traceId,
  });
}
