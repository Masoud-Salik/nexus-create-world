/**
 * E6 — FSRS scheduler as a PURE, VERSIONED library.
 *
 * Blueprint v2 rule: scheduling is deterministic and reproducible. No AI value
 * ever enters this module, no I/O happens here, and every transition is a pure
 * function of (prior state, rating, elapsed days, parameter set). The review
 * service is the only writer of the resulting state.
 */

export const SCHEDULER_VERSION = "fsrs@1";
export const PARAMETER_VERSION = "fsrs-params@1";

/** Published FSRS-4.5 default weights. Frozen: changing these needs a new version. */
export const DEFAULT_W: readonly number[] = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];

export const DESIRED_RETENTION = 0.9;
export const MAX_INTERVAL_DAYS = 365 * 5;
const DECAY = -0.5;
const FACTOR = 19 / 81;

/** 1 = again, 2 = hard, 3 = good, 4 = easy. */
export type Rating = 1 | 2 | 3 | 4;
export type CardState = "new" | "learning" | "review" | "relearning" | "suspended";

export interface FsrsState {
  stability: number;
  difficulty: number;
  state: CardState;
  repetitions: number;
  lapses: number;
}

export interface FsrsTransition {
  next: FsrsState;
  intervalDays: number;
  dueAt: Date;
  schedulerVersion: string;
  parameterVersion: string;
}

export const newState = (): FsrsState => ({
  stability: 0,
  difficulty: 0,
  state: "new",
  repetitions: 0,
  lapses: 0,
});

const clampD = (d: number) => Math.min(Math.max(d, 1), 10);
const clampS = (s: number) => Math.max(s, 0.01);

/** Predicted probability of recall after `elapsedDays` at the given stability. */
export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + FACTOR * (Math.max(elapsedDays, 0) / stability), DECAY);
}

function initialDifficulty(rating: Rating, w: readonly number[]): number {
  return clampD(w[4] - Math.exp(w[5] * (rating - 1)) + 1);
}

function nextDifficulty(d: number, rating: Rating, w: readonly number[]): number {
  const delta = d - w[6] * (rating - 3);
  const mean = w[7] * initialDifficulty(4, w) + (1 - w[7]) * delta;
  return clampD(mean);
}

function shortTermStability(s: number, rating: Rating, w: readonly number[]): number {
  return clampS(s * Math.exp(w[17] !== undefined ? w[17] * (rating - 3 + w[16]) : 0));
}

function recallStability(
  d: number, s: number, r: number, rating: Rating, w: readonly number[],
): number {
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  return clampS(
    s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) *
      (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus),
  );
}

function forgetStability(
  d: number, s: number, r: number, w: readonly number[],
): number {
  return clampS(
    w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]),
  );
}

function intervalFromStability(stability: number): number {
  const interval = (stability / FACTOR) * (Math.pow(DESIRED_RETENTION, 1 / DECAY) - 1);
  return Math.min(Math.max(Math.round(interval), 1), MAX_INTERVAL_DAYS);
}

/**
 * Deterministic transition. `now` is always server time — a client clock can
 * never influence a due date.
 */
export function schedule(
  prior: FsrsState,
  rating: Rating,
  now: Date,
  lastReviewedAt: Date | null,
  w: readonly number[] = DEFAULT_W,
): FsrsTransition {
  const elapsedDays = lastReviewedAt
    ? Math.max((now.getTime() - lastReviewedAt.getTime()) / 86_400_000, 0)
    : 0;

  let { stability, difficulty, repetitions, lapses } = prior;
  let state: CardState = prior.state;

  if (prior.state === "new" || stability <= 0) {
    difficulty = initialDifficulty(rating, w);
    stability = clampS(w[Math.min(rating - 1, 3)]);
    state = rating === 1 ? "learning" : "review";
  } else {
    const r = retrievability(stability, elapsedDays);
    difficulty = nextDifficulty(difficulty, rating, w);
    if (rating === 1) {
      stability = Math.min(forgetStability(difficulty, stability, r, w), stability);
      lapses += 1;
      state = "relearning";
    } else {
      stability = elapsedDays < 1
        ? shortTermStability(stability, rating, w)
        : recallStability(difficulty, stability, r, rating, w);
      state = "review";
    }
  }

  repetitions += 1;
  const intervalDays = rating === 1 ? 1 : intervalFromStability(stability);
  const dueAt = new Date(now.getTime() + intervalDays * 86_400_000);

  return {
    next: { stability, difficulty, state, repetitions, lapses },
    intervalDays,
    dueAt,
    schedulerVersion: SCHEDULER_VERSION,
    parameterVersion: PARAMETER_VERSION,
  };
}

/** Maps a committed grade to an FSRS rating. Deterministic, no AI input. */
export function ratingFromScore(isCorrect: boolean, score: number): Rating {
  if (!isCorrect) return 1;
  if (score >= 0.95) return 4;
  if (score >= 0.75) return 3;
  return 2;
}