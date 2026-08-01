/**
 * E3 / M3.2 — deterministic-task response cache.
 *
 * Only tasks whose output is a pure function of the input may be cached. Chat
 * and tutoring are never cached: identical prompts must stay conversational.
 * The store is per-isolate; it is an optimisation, never a correctness input.
 */
import { TaskName, getTask } from "./tasks.ts";

const FORBIDDEN: TaskName[] = ["chat", "future_predict", "study_coach", "text_to_speech"];

export function isCacheable(task: TaskName): boolean {
  if (FORBIDDEN.includes(task)) return false;
  return getTask(task).cacheable;
}

export async function cacheKey(parts: {
  task: TaskName;
  model: string;
  promptVersion: string;
  input: unknown;
}): Promise<string> {
  const raw = `${parts.task}|${parts.model}|${parts.promptVersion}|${JSON.stringify(parts.input)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs = TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheClear(): void {
  store.clear();
}