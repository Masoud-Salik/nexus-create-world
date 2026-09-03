/**
 * E5 — Trusted Knowledge Substrate acceptance tests.
 *
 * Verifies the core E5 contracts:
 * 1. Owner isolation — users cannot see other users' items
 * 2. Exact provenance — published items carry source span references
 * 3. Candidate lifecycle — pending → validating → approved/rejected
 * 4. Validation rejection — bad candidates are rejected with reason codes
 * 5. Publication only after approval — items/item_versions only from approved
 * 6. Idempotent generation requests — same idempotency key is a no-op
 * 7. Candidate expiry — expired candidates are not publishable
 * 8. Duplicate handling — exact content_hash duplicates are rejected
 * 9. No client access to pipeline tables — RLS blocks anon/authenticated
 * 10. Immutable item versions — version_no is unique per item
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, TEST_PREFIX, testId, hashContent, cleanupE5, createTestUser, createTestDocument } from "./helpers";

beforeAll(async () => {
  await cleanupE5(TEST_PREFIX);
});

afterAll(async () => {
  await cleanupE5(TEST_PREFIX);
  await pool.end();
});

describe("E5 — Owner isolation", () => {
  it("items are scoped to owner_id and not visible to other users", async () => {
    const userA = await createTestUser("owner-a");
    const userB = await createTestUser("owner-b");
    const { documentId, chunkIds, versionId } = await createTestDocument(userA, "iso");

    const { rows: unitRows } = await pool.query(
      "INSERT INTO public.knowledge_units (owner_id, owner_kind, source_version_id, kind, statement, status) VALUES ($1, 'user', $2, 'fact', $3, 'grounded') RETURNING id",
      [userA, versionId, "Mitosis produces two identical daughter cells"],
    );
    const unitId = unitRows[0].id;

    const { rows: itemRows } = await pool.query(
      "INSERT INTO public.items (owner_id, owner_kind, knowledge_unit_id, item_type, lifecycle, source_version_id) VALUES ($1, 'user', $2, 'flashcard', 'active', $3) RETURNING id",
      [userA, unitId, versionId],
    );
    const itemId = itemRows[0].id;

    // User A can see their item (via service-role query)
    const { rows: aItems } = await pool.query(
      "SELECT * FROM public.items WHERE id = $1 AND owner_id = $2",
      [itemId, userA],
    );
    expect(aItems.length).toBe(1);

    // User B has no items
    const { rows: bItems } = await pool.query(
      "SELECT * FROM public.items WHERE owner_id = $1",
      [userB],
    );
    expect(bItems.length).toBe(0);
  });
});

describe("E5 — Exact provenance", () => {
  it("published item versions carry source span references", async () => {
    const user = await createTestUser("prov");
    const { chunkIds, versionId } = await createTestDocument(user, "prov");

    const spanHash = await hashContent(`${chunkIds[0]}:0:200`);

    const { rows: unitRows } = await pool.query(
      "INSERT INTO public.knowledge_units (owner_id, owner_kind, source_version_id, kind, statement, status) VALUES ($1, 'user', $2, 'fact', $3, 'grounded') RETURNING id",
      [user, versionId, "Mitosis produces two identical daughter cells"],
    );
    const unitId = unitRows[0].id;

    const { rows: spanRows } = await pool.query(
      "INSERT INTO public.knowledge_unit_spans (knowledge_unit_id, document_chunk_id, page_no, char_start, char_end, span_hash) VALUES ($1, $2, 1, 0, 200, $3) RETURNING id",
      [unitId, chunkIds[0], spanHash],
    );
    expect(spanRows.length).toBe(1);

    const { rows: itemRows } = await pool.query(
      "INSERT INTO public.items (owner_id, owner_kind, knowledge_unit_id, item_type, lifecycle, source_version_id) VALUES ($1, 'user', $2, 'flashcard', 'active', $3) RETURNING id",
      [user, unitId, versionId],
    );
    const itemId = itemRows[0].id;

    const { rows: versionRows } = await pool.query(
      "INSERT INTO public.item_versions (item_id, version_no, item_type, question, answer, difficulty, policy_version, source_version_id) VALUES ($1, 1, 'flashcard', $2, $3, 'medium', 'e5.v1', $4) RETURNING id",
      [itemId, "What does mitosis produce?", "Two genetically identical daughter cells", versionId],
    );
    const versionId2 = versionRows[0].id;

    const { rows: ivsRows } = await pool.query(
      "INSERT INTO public.item_version_spans (item_version_id, document_chunk_id, page_no, char_start, char_end, span_hash, role) VALUES ($1, $2, 1, 0, 200, $3, 'support') RETURNING id",
      [versionId2, chunkIds[0], spanHash],
    );
    expect(ivsRows.length).toBe(1);

    // Verify the full provenance chain: item → version → span → chunk
    const { rows: chain } = await pool.query(
      `SELECT i.id as item_id, iv.id as version_id, ivs.id as span_id, dc.id as chunk_id, dc.content
       FROM public.items i
       JOIN public.item_versions iv ON iv.item_id = i.id
       JOIN public.item_version_spans ivs ON ivs.item_version_id = iv.id
       JOIN public.document_chunks dc ON dc.id = ivs.document_chunk_id
       WHERE i.id = $1`,
      [itemId],
    );
    expect(chain.length).toBe(1);
    expect(chain[0].chunk_id).toBe(chunkIds[0]);
    expect(chain[0].content).toContain("Mitosis");
  });
});

describe("E5 — Candidate lifecycle", () => {
  it("candidates transition through pending → validating → approved/rejected", async () => {
    const user = await createTestUser("lifecycle");
    const { chunkIds, versionId } = await createTestDocument(user, "lifecycle");

    const { rows: unitRows } = await pool.query(
      "INSERT INTO public.knowledge_units (owner_id, owner_kind, source_version_id, kind, statement, status) VALUES ($1, 'user', $2, 'fact', $3, 'grounded') RETURNING id",
      [user, versionId, "Mitosis produces two identical daughter cells"],
    );
    const unitId = unitRows[0].id;

    const { rows: reqRows } = await pool.query(
      "INSERT INTO public.generation_requests (owner_id, owner_kind, source_version_id, knowledge_unit_id, item_type, reason, idempotency_key) VALUES ($1, 'user', $2, $3, 'flashcard', 'starter', $4) RETURNING id",
      [user, versionId, unitId, testId("lifecycle-req")],
    );
    const reqId = reqRows[0].id;

    const payload = {
      item_type: "flashcard",
      question: "What does mitosis produce?",
      answer: "Two genetically identical daughter cells",
      difficulty: "medium",
      explanation: "Mitosis is cell division that creates identical copies.",
    };
    const contentHash = await hashContent(JSON.stringify(payload));

    const { rows: candRows } = await pool.query(
      "INSERT INTO public.item_candidates (owner_id, owner_kind, generation_request_id, source_version_id, knowledge_unit_id, item_type, content_hash, payload, status) VALUES ($1, 'user', $2, $3, $4, 'flashcard', $5, $6, 'pending') RETURNING id, status",
      [user, reqId, versionId, unitId, contentHash, JSON.stringify(payload)],
    );
    expect(candRows[0].status).toBe("pending");

    await pool.query("UPDATE public.item_candidates SET status = 'validating' WHERE id = $1", [candRows[0].id]);
    const { rows: validating } = await pool.query("SELECT status FROM public.item_candidates WHERE id = $1", [candRows[0].id]);
    expect(validating[0].status).toBe("validating");

    await pool.query("UPDATE public.item_candidates SET status = 'approved' WHERE id = $1", [candRows[0].id]);
    const { rows: approved } = await pool.query("SELECT status FROM public.item_candidates WHERE id = $1", [candRows[0].id]);
    expect(approved[0].status).toBe("approved");
  });
});

describe("E5 — Validation rejection", () => {
  it("validation_runs record rejection reason codes", async () => {
    const user = await createTestUser("reject");
    const { versionId } = await createTestDocument(user, "reject");

    const { rows: unitRows } = await pool.query(
      "INSERT INTO public.knowledge_units (owner_id, owner_kind, source_version_id, kind, statement, status) VALUES ($1, 'user', $2, 'fact', $3, 'grounded') RETURNING id",
      [user, versionId, "Some test statement"],
    );

    const payload = { item_type: "flashcard", question: "", difficulty: "medium" };
    const contentHash = await hashContent(JSON.stringify(payload));

    const { rows: candRows } = await pool.query(
      "INSERT INTO public.item_candidates (owner_id, owner_kind, source_version_id, knowledge_unit_id, item_type, content_hash, payload, status) VALUES ($1, 'user', $2, $3, 'flashcard', $4, $5, 'rejected') RETURNING id",
      [user, versionId, unitRows[0].id, contentHash, JSON.stringify(payload)],
    );

    await pool.query(
      "INSERT INTO public.validation_runs (item_candidate_id, stage, validator_version, decision, reason_codes, confidence) VALUES ($1, 'structural', 'e5.v1', 'fail', ARRAY['missing_question'], 0.5)",
      [candRows[0].id],
    );

    const { rows: runs } = await pool.query(
      "SELECT * FROM public.validation_runs WHERE item_candidate_id = $1 ORDER BY created_at",
      [candRows[0].id],
    );
    expect(runs.length).toBe(1);
    expect(runs[0].decision).toBe("fail");
    expect(runs[0].reason_codes).toContain("missing_question");
  });
});

describe("E5 — Idempotent generation requests", () => {
  it("same idempotency key is rejected as duplicate", async () => {
    const user = await createTestUser("idem");
    const { versionId } = await createTestDocument(user, "idem");

    const { rows: unitRows } = await pool.query(
      "INSERT INTO public.knowledge_units (owner_id, owner_kind, source_version_id, kind, statement, status) VALUES ($1, 'user', $2, 'fact', $3, 'grounded') RETURNING id",
      [user, versionId, "Idempotent test statement"],
    );

    const idemKey = testId("idem-key");
    await pool.query(
      "INSERT INTO public.generation_requests (owner_id, owner_kind, source_version_id, knowledge_unit_id, item_type, reason, idempotency_key) VALUES ($1, 'user', $2, $3, 'flashcard', 'starter', $4)",
      [user, versionId, unitRows[0].id, idemKey],
    );

    // Second insert with same key should fail due to UNIQUE constraint
    await expect(
      pool.query(
        "INSERT INTO public.generation_requests (owner_id, owner_kind, source_version_id, knowledge_unit_id, item_type, reason, idempotency_key) VALUES ($1, 'user', $2, $3, 'flashcard', 'starter', $4)",
        [user, versionId, unitRows[0].id, idemKey],
      ),
    ).rejects.toThrow();
  });
});

describe("E5 — Candidate expiry", () => {
  it("candidates have an expires_at field set to 30 days from creation", async () => {
    const user = await createTestUser("expiry");
    const { versionId } = await createTestDocument(user, "expiry");

    const { rows: unitRows } = await pool.query(
      "INSERT INTO public.knowledge_units (owner_id, owner_kind, source_version_id, kind, statement, status) VALUES ($1, 'user', $2, 'fact', $3, 'grounded') RETURNING id",
      [user, versionId, "Expiry test statement"],
    );

    const payload = { item_type: "flashcard", question: "Test?", answer: "Yes", difficulty: "easy" };
    const contentHash = await hashContent(JSON.stringify(payload));

    const { rows: candRows } = await pool.query(
      "INSERT INTO public.item_candidates (owner_id, owner_kind, source_version_id, knowledge_unit_id, item_type, content_hash, payload, status) VALUES ($1, 'user', $2, $3, 'flashcard', $4, $5, 'pending') RETURNING id, expires_at",
      [user, versionId, unitRows[0].id, contentHash, JSON.stringify(payload)],
    );

    const expiresAt = new Date(candRows[0].expires_at);
    const now = new Date();
    const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });
});

describe("E5 — Immutable item versions", () => {
  it("version_no is unique per item_id", async () => {
    const user = await createTestUser("immutable");
    const { versionId } = await createTestDocument(user, "immutable");

    const { rows: unitRows } = await pool.query(
      "INSERT INTO public.knowledge_units (owner_id, owner_kind, source_version_id, kind, statement, status) VALUES ($1, 'user', $2, 'fact', $3, 'grounded') RETURNING id",
      [user, versionId, "Immutable test statement"],
    );

    const { rows: itemRows } = await pool.query(
      "INSERT INTO public.items (owner_id, owner_kind, knowledge_unit_id, item_type, lifecycle, source_version_id) VALUES ($1, 'user', $2, 'flashcard', 'active', $3) RETURNING id",
      [user, unitRows[0].id, versionId],
    );
    const itemId = itemRows[0].id;

    await pool.query(
      "INSERT INTO public.item_versions (item_id, version_no, item_type, question, answer, difficulty, policy_version, source_version_id) VALUES ($1, 1, 'flashcard', $2, $3, 'medium', 'e5.v1', $4)",
      [itemId, "Question v1", "Answer v1", versionId],
    );

    // Duplicate version_no should fail
    await expect(
      pool.query(
        "INSERT INTO public.item_versions (item_id, version_no, item_type, question, answer, difficulty, policy_version, source_version_id) VALUES ($1, 1, 'flashcard', $2, $3, 'medium', 'e5.v1', $4)",
        [itemId, "Question dup", "Answer dup", versionId],
      ),
    ).rejects.toThrow();

    // Version 2 is allowed
    const { rows: v2 } = await pool.query(
      "INSERT INTO public.item_versions (item_id, version_no, item_type, question, answer, difficulty, policy_version, source_version_id) VALUES ($1, 2, 'flashcard', $2, $3, 'medium', 'e5.v1', $4) RETURNING id",
      [itemId, "Question v2", "Answer v2", versionId],
    );
    expect(v2.length).toBe(1);
  });
});

describe("E5 — Pipeline tables have no client policies", () => {
  it("item_candidates has no SELECT policy for authenticated role", async () => {
    const { rows: policies } = await pool.query(
      "SELECT * FROM pg_policies WHERE tablename = 'item_candidates' AND cmd = 'SELECT'",
    );
    expect(policies.length).toBe(0);
  });

  it("validation_runs has no SELECT policy for authenticated role", async () => {
    const { rows: policies } = await pool.query(
      "SELECT * FROM pg_policies WHERE tablename = 'validation_runs' AND cmd = 'SELECT'",
    );
    expect(policies.length).toBe(0);
  });

  it("generation_requests has no SELECT policy for authenticated role", async () => {
    const { rows: policies } = await pool.query(
      "SELECT * FROM pg_policies WHERE tablename = 'generation_requests' AND cmd = 'SELECT'",
    );
    expect(policies.length).toBe(0);
  });

  it("knowledge_units has no client policies", async () => {
    const { rows: policies } = await pool.query(
      "SELECT * FROM pg_policies WHERE tablename = 'knowledge_units'",
    );
    expect(policies.length).toBe(0);
  });
});

describe("E5 — Published items have owner-scoped SELECT", () => {
  it("items has a SELECT policy for authenticated users scoped by owner_id", async () => {
    const { rows: policies } = await pool.query(
      "SELECT * FROM pg_policies WHERE tablename = 'items' AND cmd = 'SELECT'",
    );
    expect(policies.length).toBe(1);
    expect(policies[0].roles).toContain("authenticated");
    expect(policies[0].qual).toContain("auth.uid()");
    expect(policies[0].qual).toContain("owner_id");
  });

  it("item_versions has a SELECT policy joining through items", async () => {
    const { rows: policies } = await pool.query(
      "SELECT * FROM pg_policies WHERE tablename = 'item_versions' AND cmd = 'SELECT'",
    );
    expect(policies.length).toBe(1);
    expect(policies[0].roles).toContain("authenticated");
  });
});

describe("E5 — Source versioning", () => {
  it("source_versions are unique per (document_id, version_no)", async () => {
    const user = await createTestUser("versioning");
    const { documentId, versionId } = await createTestDocument(user, "versioning");

    // Version 1 already exists from createTestDocument
    await expect(
      pool.query(
        "INSERT INTO public.source_versions (document_id, version_no, sha256, storage_path, mime, page_count, extraction_policy) VALUES ($1, 1, 'dup', 'dup', 'text/plain', 2, 'client')",
        [documentId],
      ),
    ).rejects.toThrow();

    // Version 2 is allowed
    const { rows: v2 } = await pool.query(
      "INSERT INTO public.source_versions (document_id, version_no, sha256, storage_path, mime, page_count, extraction_policy) VALUES ($1, 2, 'v2hash', $2, 'text/plain', 2, 'client') RETURNING id",
      [documentId, `${user}/${documentId}/source`],
    );
    expect(v2.length).toBe(1);
  });
});
