// XP / Level system shared across Focus + Blueprint.
// Curve: level n requires sqrt(totalXp / 50) + 1 floor.

export function xpFromSession(opts: {
  minutes: number;
  difficulty?: "easy" | "medium" | "hard";
  focusScore?: number; // 0-100
  bonus?: boolean;
}): number {
  const diffMult = opts.difficulty === "hard" ? 1.25 : opts.difficulty === "easy" ? 0.85 : 1;
  const focusMult = 0.8 + (opts.focusScore ?? 70) / 200; // 0.8 .. 1.3
  const bonusMult = opts.bonus ? 1.5 : 1;
  return Math.max(1, Math.round(opts.minutes * diffMult * focusMult * bonusMult));
}

export function levelFromXp(totalXp: number): {
  level: number;
  xpInLevel: number;
  xpForLevel: number;
  xpToNext: number;
} {
  // Quadratic curve: total XP to reach level L = 50 * (L-1)^2
  const level = Math.floor(Math.sqrt(totalXp / 50)) + 1;
  const xpStart = 50 * Math.pow(level - 1, 2);
  const xpEnd = 50 * Math.pow(level, 2);
  const xpInLevel = totalXp - xpStart;
  const xpForLevel = xpEnd - xpStart;
  return { level, xpInLevel, xpForLevel, xpToNext: xpForLevel - xpInLevel };
}