import { describe, it, expect } from "vitest";
import {
  schedule, newState, ratingFromScore, retrievability, DEFAULT_W,
} from "../../supabase/functions/_shared/knowledge/fsrs.ts";
import { grade, normalize } from "../../supabase/functions/_shared/knowledge/grade.ts";

const NOW = new Date("2026-01-01T00:00:00Z");

describe("fsrs scheduler", () => {
  it("is deterministic for identical inputs", () => {
    const a = schedule(newState(), 3, NOW, null);
    const b = schedule(newState(), 3, NOW, null);
    expect(a).toEqual(b);
  });

  it("schedules a lapse for tomorrow and counts it", () => {
    const prior = schedule(newState(), 3, NOW, null).next;
    const lapse = schedule(prior, 1, NOW, NOW);
    expect(lapse.intervalDays).toBe(1);
    expect(lapse.next.lapses).toBe(1);
    expect(lapse.next.state).toBe("relearning");
  });

  it("gives easy a longer interval than good", () => {
    const good = schedule(newState(), 3, NOW, null);
    const easy = schedule(newState(), 4, NOW, null);
    expect(easy.intervalDays).toBeGreaterThanOrEqual(good.intervalDays);
  });

  it("never exceeds the interval cap and always moves the due date forward", () => {
    let state = newState();
    let last: Date | null = null;
    let now = NOW;
    for (let i = 0; i < 30; i++) {
      const t = schedule(state, 4, now, last);
      expect(t.intervalDays).toBeGreaterThan(0);
      expect(t.intervalDays).toBeLessThanOrEqual(365 * 5);
      expect(t.dueAt.getTime()).toBeGreaterThan(now.getTime());
      state = t.next;
      last = now;
      now = t.dueAt;
    }
    expect(state.repetitions).toBe(30);
  });

  it("decays retrievability over time", () => {
    expect(retrievability(10, 0)).toBeCloseTo(1, 5);
    expect(retrievability(10, 30)).toBeLessThan(retrievability(10, 5));
  });

  it("uses the frozen published parameter set", () => {
    expect(DEFAULT_W).toHaveLength(17);
  });

  it("maps grades to ratings without AI input", () => {
    expect(ratingFromScore(false, 1)).toBe(1);
    expect(ratingFromScore(true, 1)).toBe(4);
    expect(ratingFromScore(true, 0.8)).toBe(3);
    expect(ratingFromScore(true, 0.5)).toBe(2);
  });
});

describe("deterministic graders", () => {
  it("normalizes case, accents and punctuation", () => {
    expect(normalize("  État, de   choc! ")).toBe("etat de choc");
  });

  it("grades normalized answers against any accepted value", () => {
    const r = grade("normalized", "Mitosis!", { values: ["mitosis", "cell division"] });
    expect(r.isCorrect).toBe(true);
    expect(r.score).toBe(1);
  });

  it("penalizes wrong picks in set grading", () => {
    const r = grade("set", ["a", "b", "z"], { values: ["a", "b", "c"] });
    expect(r.score).toBeCloseTo(1 / 3, 5);
    expect(r.isCorrect).toBe(false);
  });

  it("honours numeric tolerance", () => {
    expect(grade("numeric", 9.81, { value: 9.8, tolerance: 0.05 }).isCorrect).toBe(true);
    expect(grade("numeric", 9.5, { value: 9.8, tolerance: 0.05 }).isCorrect).toBe(false);
  });

  it("defers semantic grading instead of guessing", () => {
    const r = grade("semantic", "some prose", { value: "x" });
    expect(r.deferred).toBe(true);
    expect(r.isCorrect).toBe(false);
  });
});
