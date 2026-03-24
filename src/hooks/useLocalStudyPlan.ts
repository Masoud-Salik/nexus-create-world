import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { StudyTaskData } from "@/components/study-coach/TaskCard";

const STORAGE_KEY = "study_coach_daily_plan";

interface CachedPlan {
  date: string;
  tasks: StudyTaskData[];
  lastUpdated: number;
}

export function useLocalStudyPlan(userId: string | null) {
  const [cachedTasks, setCachedTasks] = useState<StudyTaskData[]>([]);
  const [isCacheValid, setIsCacheValid] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const cacheKey = `${STORAGE_KEY}_${userId}`;

  // Load from localStorage on mount
  useEffect(() => {
    if (!userId) return;

    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed: CachedPlan = JSON.parse(stored);
        if (parsed.date === today) {
          setCachedTasks(parsed.tasks);
          setIsCacheValid(true);
        } else {
          // Clear stale cache
          localStorage.removeItem(cacheKey);
          setIsCacheValid(false);
        }
      }
    } catch (e) {
      console.error("Failed to load cached study plan:", e);
    }
  }, [userId, today, cacheKey]);

  // Save to localStorage
  const saveTasks = useCallback(
    (tasks: StudyTaskData[]) => {
      if (!userId) return;

      setCachedTasks(tasks);
      setIsCacheValid(true);

      const plan: CachedPlan = {
        date: today,
        tasks,
        lastUpdated: Date.now(),
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(plan));
      } catch (e) {
        console.error("Failed to save study plan to cache:", e);
      }
    },
    [userId, today, cacheKey]
  );

  // Update a single task locally (instant, no server call)
  const updateTaskLocally = useCallback(
    (taskId: string, updates: Partial<StudyTaskData>) => {
      setCachedTasks((prev) => {
        const updated = prev.map((t) =>
          t.id === taskId ? { ...t, ...updates } : t
        );

        // Also update localStorage
        const plan: CachedPlan = {
          date: today,
          tasks: updated,
          lastUpdated: Date.now(),
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(plan));
        } catch (e) {
          console.error("Failed to update cached task:", e);
        }

        return updated;
      });
    },
    [today, cacheKey]
  );

  // Clear cache
  const clearCache = useCallback(() => {
    if (!userId) return;
    localStorage.removeItem(cacheKey);
    setCachedTasks([]);
    setIsCacheValid(false);
  }, [userId, cacheKey]);

  return {
    cachedTasks,
    isCacheValid,
    saveTasks,
    updateTaskLocally,
    clearCache,
  };
}
