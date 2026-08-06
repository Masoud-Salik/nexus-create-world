/**
 * E6 — deterministic graders.
 *
 * Everything gradable without a model is graded here, synchronously, so the
 * core review loop keeps working when every AI provider is down. Only
 * `semantic` defers to the AI boundary (asynchronously, elsewhere).
 */

export type GradeMethod =
  | "exact" | "normalized" | "set" | "numeric" | "semantic" | "manual";

export interface GradeResult {
  isCorrect: boolean;
  score: number;
  method: GradeMethod;
  graderVersion: string;
  deferred: boolean;
}

export const GRADER_VERSION = "grade@1";

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)) : v == null ? [] : [String(v)];

function gradeNumeric(response: unknown, expected: unknown, tolerance: number): boolean {
  const a = Number(response);
  const b = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= Math.abs(tolerance);
}

/**
 * `answer` is the immutable answer payload of the item version.
 * Shape: { value?: unknown, values?: unknown[], tolerance?: number }
 */
export function grade(
  method: GradeMethod,
  response: unknown,
  answer: Record<string, unknown>,
): GradeResult {
  const base = { method, graderVersion: GRADER_VERSION, deferred: false };

  switch (method) {
    case "exact": {
      const ok = String(response ?? "") === String(answer.value ?? "");
      return { ...base, isCorrect: ok, score: ok ? 1 : 0 };
    }
    case "normalized": {
      const expected = asArray(answer.values ?? answer.value).map(normalize);
      const got = normalize(String(response ?? ""));
      const ok = expected.includes(got);
      return { ...base, isCorrect: ok, score: ok ? 1 : 0 };
    }
    case "set": {
      const expected = new Set(asArray(answer.values).map(normalize));
      const got = new Set(asArray(response).map(normalize));
      if (expected.size === 0) return { ...base, isCorrect: false, score: 0 };
      let hit = 0;
      for (const v of got) if (expected.has(v)) hit++;
      const wrong = got.size - hit;
      const score = Math.max(0, (hit - wrong) / expected.size);
      return { ...base, isCorrect: score === 1, score };
    }
    case "numeric": {
      const ok = gradeNumeric(response, answer.value, Number(answer.tolerance ?? 0));
      return { ...base, isCorrect: ok, score: ok ? 1 : 0 };
    }
    case "manual":
    case "semantic":
      // Acknowledged now, graded out of band. Never blocks the learner.
      return { ...base, isCorrect: false, score: 0, deferred: true };
  }
}