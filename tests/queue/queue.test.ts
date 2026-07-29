/**
 * E2 / M2.3 — queue acceptance tests.
 *
 * Covers the four contracts E2 is accepted on: no double-processing under
 * concurrent drains, retry with backoff, poison message -> dead-letter, and
 * idempotent enqueue.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claim, cleanup, enqueue, FAIL_KIND, getJob, pool, testKey, TEST_KIND } from "./helpers";

const PREFIX = `test:`;

beforeAll(async () => {
  await cleanup(PREFIX);
});

afterAll(async () => {
  await cleanup(PREFIX);
  await pool.end();
});

describe("enqueue_job", () => {
  it("is idempotent on key", async () => {
    const key = testKey("idem", 1);
    const first = await enqueue(TEST_KIND, key);
    const second = await enqueue(TEST_KIND, key);
    expect(second).toBe(first);

    const { rows } = await pool.query("select count(*)::int as n from public.jobs where key = $1", [
      key,
    ]);
    expect(rows[0].n).toBe(1);
  });
});

describe("claim_jobs", () => {
  it("never hands the same job to two concurrent drains", async () => {
    const total = 200;
    const keys = Array.from({ length: total }, (_, i) => testKey("concurrency", i));
    await Promise.all(keys.map((k) => enqueue(TEST_KIND, k)));

    // Five drains racing, each taking batches of 10 until the queue is empty.
    const drain = async () => {
      const seen: string[] = [];
      for (;;) {
        const batch = await claim(TEST_KIND, 10);
        if (batch.length === 0) break;
        seen.push(...batch.map((j) => j.id));
      }
      return seen;
    };

    const results = await Promise.all([drain(), drain(), drain(), drain(), drain()]);
    const claimed = results.flat();
    const unique = new Set(claimed);

    expect(claimed.length).toBe(unique.size); // zero double-processing
    expect(unique.size).toBe(total); // nothing lost
  });

  it("increments attempts and sets a lease", async () => {
    const key = testKey("lease", 1);
    const id = await enqueue(TEST_KIND, key);
    const [claimed] = await claim(TEST_KIND, 1);
    expect(claimed.id).toBe(id);

    const job = await getJob(id);
    expect(job.status).toBe("running");
    expect(job.attempts).toBe(1);
    expect(new Date(job.lease_until).getTime()).toBeGreaterThan(Date.now());
  });

  it("reclaims a job whose lease has expired", async () => {
    const key = testKey("expired-lease", 1);
    const id = await enqueue(TEST_KIND, key);
    await claim(TEST_KIND, 1, 5);
    await pool.query("update public.jobs set lease_until = now() - interval '1 minute' where id = $1", [id]);

    const again = await claim(TEST_KIND, 5);
    expect(again.map((j) => j.id)).toContain(id);
    expect((await getJob(id)).attempts).toBe(2);
  });
});

describe("fail_job", () => {
  it("retries with exponential backoff before the ceiling", async () => {
    const key = testKey("backoff", 1);
    const id = await enqueue(FAIL_KIND, key, 5);
    await claim(FAIL_KIND, 1);

    const { rows } = await pool.query("select public.fail_job($1, $2) as status", [id, "boom"]);
    expect(rows[0].status).toBe("pending");

    const job = await getJob(id);
    expect(job.last_error).toBe("boom");
    // attempts = 1 -> 2^1 = 2 minutes out.
    const delayMs = new Date(job.next_run_at).getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(60_000);
    expect(delayMs).toBeLessThan(3 * 60_000);
  });

  it("dead-letters a poison message at the attempt ceiling", async () => {
    const key = testKey("poison", 1);
    const id = await enqueue(FAIL_KIND, key, 2);

    for (let i = 0; i < 2; i++) {
      await pool.query("update public.jobs set next_run_at = now() where id = $1", [id]);
      await claim(FAIL_KIND, 1);
      await pool.query("select public.fail_job($1, $2)", [id, "always fails"]);
    }

    const job = await getJob(id);
    expect(job.status).toBe("dead");
    expect(job.attempts).toBe(2);
    expect(job.lease_until).toBeNull();
  });
});

describe("complete_job", () => {
  it("marks the job done and clears the lease", async () => {
    const key = testKey("complete", 1);
    const id = await enqueue(TEST_KIND, key);
    await claim(TEST_KIND, 1);
    await pool.query("select public.complete_job($1)", [id]);

    const job = await getJob(id);
    expect(job.status).toBe("done");
    expect(job.lease_until).toBeNull();
    expect(job.last_error).toBeNull();
  });
});