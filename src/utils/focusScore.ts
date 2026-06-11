export function calcFocusScore(opts: {
  elapsedSeconds: number;
  plannedSeconds: number;
  distractions: number;
  selfRating?: 1 | 2 | 3;
}): { score: number; xp: number; band: "flow" | "good" | "ok" | "fragmented" } {
  const completion = Math.min(1, opts.elapsedSeconds / Math.max(1, opts.plannedSeconds));
  const minutes = opts.elapsedSeconds / 60;
  const lengthFactor = Math.min(1.15, 0.7 + Math.log10(1 + minutes / 5) * 0.35);
  const distractionPenalty = Math.min(0.6, opts.distractions * 0.08);
  const ratingFactor = opts.selfRating ? [0.85, 1, 1.1][opts.selfRating - 1] : 1;
  const raw = completion * lengthFactor * (1 - distractionPenalty) * ratingFactor * 100;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const xp = Math.round(minutes * (0.8 + score / 200));
  let band: "flow" | "good" | "ok" | "fragmented" = "fragmented";
  if (score >= 85) band = "flow";
  else if (score >= 65) band = "good";
  else if (score >= 40) band = "ok";
  return { score, xp, band };
}