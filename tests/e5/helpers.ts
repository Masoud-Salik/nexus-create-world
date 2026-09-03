/**
 * E5 — shared test helpers for the trusted knowledge substrate tests.
 *
 * Direct-to-Postgres, mirroring the queue test harness. All test rows are
 * namespaced with a unique prefix so they never collide with real data.
 */
import { Pool } from "pg";

export const pool = new Pool({ max: 12 });

export const TEST_PREFIX = `e5test:${process.env.VITEST_RUN_ID ?? "local"}`;

/** Generate a unique UUID-like string for test rows. */
export function testId(label: string): string {
  return `${TEST_PREFIX}:${label}:${Math.random().toString(36).slice(2, 10)}`;
}

/** Hash content for span dedup, mirroring the edge function logic. */
export async function hashContent(content: string): Promise<string> {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(content).digest("hex");
}

/** Clean up all test rows across E5 tables. */
export async function cleanupE5(prefix: string): Promise<void> {
  const like = `${prefix}%`;
  await pool.query("DELETE FROM public.item_version_spans WHERE span_hash LIKE $1", [like]);
  await pool.query("DELETE FROM public.item_versions WHERE question LIKE $1", [like]);
  await pool.query("DELETE FROM public.items WHERE owner_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM public.validation_runs v USING public.item_candidates c WHERE v.item_candidate_id = c.id AND c.owner_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM public.item_candidates WHERE owner_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM public.generation_requests WHERE owner_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM public.knowledge_unit_spans s USING public.knowledge_units k WHERE s.knowledge_unit_id = k.id AND k.owner_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM public.knowledge_units WHERE owner_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM public.source_versions WHERE storage_path LIKE $1", [like]);
  await pool.query("DELETE FROM public.document_chunks WHERE user_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM public.document_pages WHERE user_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM public.documents WHERE user_id::text LIKE $1", [like]);
  await pool.query("DELETE FROM auth.users WHERE id::text LIKE $1", [like]);
}

/** Create a test user in auth.users and return the id. */
export async function createTestUser(label: string): Promise<string> {
  const id = testId(label);
  await pool.query(
    "INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, instance_id, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, now(), now())",
    [id, "authenticated", "authenticated", `${id}@test.local`, "test-hash", "00000000-0000-0000-0000-000000000000", { provider: "email", providers: ["email"] }, {}],
  );
  return id;
}

/** Create a test document with pages and chunks, return document + chunk ids. */
export async function createTestDocument(userId: string, label: string): Promise<{ documentId: string; chunkIds: string[]; versionId: string }> {
  const documentId = testId(label);
  const chunkIds: string[] = [];

  await pool.query(
    "INSERT INTO public.documents (id, user_id, title, mime, bytes, sha256, page_count, status, storage_path) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [documentId, userId, `${label} doc`, "text/plain", 1000, "testhash", 2, "ready", `${userId}/${documentId}/source`],
  );

  await pool.query(
    "INSERT INTO public.document_pages (document_id, user_id, page_no, text, has_text_layer) VALUES ($1, $2, 1, $3, true), ($1, $2, 2, $4, true)",
    [documentId, userId, "Page one content about mitosis and cell division.", "Page two content about photosynthesis."],
  );

  for (let i = 0; i < 2; i++) {
    const chunkId = testId(`${label}-chunk-${i}`);
    chunkIds.push(chunkId);
    await pool.query(
      "INSERT INTO public.document_chunks (id, document_id, user_id, chunk_index, content, page_no, char_start, char_end, token_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [
        chunkId,
        documentId,
        userId,
        i,
        i === 0 ? "Mitosis is the process by which a cell divides into two genetically identical daughter cells. This process is essential for growth and repair in multicellular organisms." : "Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose molecules.",
        i + 1,
        0,
        200,
        50,
      ],
    );
  }

  const { rows: versionRows } = await pool.query(
    "INSERT INTO public.source_versions (document_id, version_no, sha256, storage_path, mime, page_count, extraction_policy) VALUES ($1, 1, $2, $3, $4, 2, 'client') RETURNING id",
    [documentId, "testhash", `${userId}/${documentId}/source`, "text/plain"],
  );

  return { documentId, chunkIds, versionId: versionRows[0].id };
}
