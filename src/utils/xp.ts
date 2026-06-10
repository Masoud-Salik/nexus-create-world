import { StudyTaskData } from "@/components/study-coach/TaskCard";

const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

export function taskXp(task: Pick<StudyTaskData, "duration_minutes" | "difficulty">): number {
  const mult = DIFFICULTY_MULTIPLIER[task.difficulty] ?? 1;
  return Math.round(task.duration_minutes * mult);
}

export function levelFromXp(totalXp: number): { level: number; xpInLevel: number; xpForNext: number } {
  // Level curve: level n requires (n^2 * 50) total XP
  const level = Math.max(1, Math.floor(Math.sqrt(Math.max(0, totalXp) / 50)) + 1);
  const xpAtLevel = ((level - 1) ** 2) * 50;
  const xpAtNext = (level ** 2) * 50;
  return {
    level,
    xpInLevel: Math.max(0, totalXp - xpAtLevel),
    xpForNext: xpAtNext - xpAtLevel,
  };
}

export function sumXp(tasks: StudyTaskData[]): number {
  return tasks.reduce((s, t) => s + taskXp(t), 0);
}