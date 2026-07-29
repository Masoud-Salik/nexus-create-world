/**
 * E2 / M2.3 — direct-to-Postgres harness for the queue tests.
 *
 * The queue is service-role-only, so these tests exercise the SQL contract
 * (`enqueue_job`, `claim_jobs`, `complete_job`, `fail_job`) rather than going
 * through PostgREST. Connection comes from the standard PG* environment.
 */
import { Pool } from "pg";

export const pool = new Pool({ max: 12 });

/** Every test row is namespaced so a run never collides with real work. */
export const TEST_KIND = "__noop";
export const FAIL_KIND = "__fail";

export function testKey(suite: string, n: number | string): string {
  return `test:${suite}:${process.env.VITEST_RUN_ID ?? "local"}:${n}`;
}

export async function enqueue(kind: string, key: string, maxAttempts = 5) {
  const { rows } = await pool.query(
    "select public.enqueue_job($1, $2, $3::jsonb, now(), $4, $5) as id",
    [kind, key, JSON.stringify({}), maxAttempts, "test-trace"],
  );
  return rows[0].id as string;
}

export async function claim(kind: string | null, n: number, leaseSeconds = 120) {
  const { rows } = await pool.query("select * from public.claim_jobs($1, $2, $3)", [
    kind,
    n,
    leaseSeconds,
  ]);
  return rows as Array<{ id: string; key: string; attempts: number; status: string }>;
}

export async function getJob(id: string) {
  const { rows } = await pool.query("select * from public.jobs where id = $1", [id]);
  return rows[0];
}

export async function cleanup(prefix: string) {
  await pool.query("delete from public.jobs where key like $1", [`${prefix}%`]);
}