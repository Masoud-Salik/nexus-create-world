import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  Loader2,
  LogIn,
  Sparkles,
  BookOpen,
  Sliders,
  Zap,
  Timer,
  ClipboardList,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import { StudyAnalytics } from "@/components/study-coach/StudyAnalytics";
import type { StudyTaskData } from "@/components/study-coach/TaskCard";
import {
  StudyTaskTimer,
  ActiveTask,
  CompletionStatus,
} from "@/components/study-coach/StudyTaskTimer";
import { SubjectManager } from "@/components/study-coach/SubjectManager";
import {
  PlanDurationSelector,
  PlanDuration,
} from "@/components/study-coach/PlanDurationSelector";
import { FocusCockpit } from "@/components/study-coach/focus/FocusCockpit";
import { StudyPath } from "@/components/study-coach/blueprint/StudyPath";
import { LifeProgress } from "@/components/study-coach/blueprint/LifeProgress";
import { WeekRibbon } from "@/components/study-coach/blueprint/WeekRibbon";
import { PlanAdjusterSheet } from "@/components/study-coach/blueprint/PlanAdjusterSheet";
import {
  useStudyProgress,
  encodeSessionNote,
} from "@/hooks/useStudyProgress";
import { useLocalStudyPlan } from "@/hooks/useLocalStudyPlan";
import { BackgroundMusicPlayer } from "@/components/study-coach/BackgroundMusicPlayer";
import { FloatingAIChat } from "@/components/study-coach/FloatingAIChat";
import {
  format,
  startOfWeek,
  endOfWeek,
  parse,
  subDays,
} from "date-fns";
import { Auth } from "@/components/Auth";
import { getUserFriendlyError } from "@/utils/errorUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Book,
  Calculator,
  Atom,
  Globe,
  Music as MusicIcon,
  Pen,
} from "lucide-react";

type StudyMode = "timer" | "plan" | "stats";

interface Subject {
  id: string;
  subject_name: string;
  icon_name: string;
  color: string;
  weekly_target_minutes: number;
}

type WeekTask = StudyTaskData & {
  task_date: string;
};

const DEMO_SUBJECTS: Subject[] = [
  {
    id: "demo-1",
    subject_name: "Mathematics",
    icon_name: "calculator",
    color: "#3b82f6",
    weekly_target_minutes: 300,
  },
  {
    id: "demo-2",
    subject_name: "Physics",
    icon_name: "atom",
    color: "#8b5cf6",
    weekly_target_minutes: 240,
  },
  {
    id: "demo-3",
    subject_name: "English",
    icon_name: "book-open",
    color: "#10b981",
    weekly_target_minutes: 180,
  },
];

const DEMO_TASKS: StudyTaskData[] = [
  {
    id: "demo-t1",
    subject_name: "Mathematics",
    icon_name: "calculator",
    color: "#3b82f6",
    topic: "Calculus - Derivatives",
    duration_minutes: 45,
    difficulty: "medium",
    status: "pending",
  },
  {
    id: "demo-t2",
    subject_name: "Physics",
    icon_name: "atom",
    color: "#8b5cf6",
    topic: "Quantum Mechanics Basics",
    duration_minutes: 30,
    difficulty: "hard",
    status: "pending",
  },
  {
    id: "demo-t3",
    subject_name: "English",
    icon_name: "book-open",
    color: "#10b981",
    topic: "Essay Writing Practice",
    duration_minutes: 25,
    difficulty: "easy",
    status: "completed",
  },
];

/**
 * Guest banner
 *
 * Deliberately kept simple. It is presentation-only and does not control
 * authentication state.
 */
function GuestBanner({ isGuest }: { isGuest: boolean }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!isGuest) {
      setVisible(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [isGuest]);

  if (!isGuest || !visible) {
    return null;
  }

  return (
    <Link
      to="/chat"
      className="mb-3 flex w-full items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 transition-opacity hover:bg-primary/15 tap-effect"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm font-medium text-foreground">Demo Mode</span>
      <LogIn className="ml-auto h-4 w-4 text-primary" />
    </Link>
  );
}

export default function StudyCoach() {
  usePageMeta({
    title: "Study Coach",
    description: "AI-powered study planning",
  });

  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const [studyMode, setStudyMode] = useState<StudyMode>("timer");

  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);

  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  const [weekTasks, setWeekTasks] = useState<WeekTask[]>([]);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streak, setStreak] = useState(0);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);

  /**
   * Prevents multiple overlapping loadData() calls from allowing an older
   * request to overwrite newer state.
   */
  const loadRequestIdRef = useRef(0);

  /**
   * Prevents async operations from updating state after unmount.
   */
  const mountedRef = useRef(true);

  /**
   * Prevents the automatic generation effect from firing repeatedly during
   * the same mounted session.
   */
  const autoGenerateAttempted = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const {
    cachedTasks,
    isCacheValid,
    saveTasks,
    updateTaskLocally,
    clearCache,
  } = useLocalStudyPlan(userId);

  const {
    progress,
    refresh: refreshProgress,
  } = useStudyProgress(userId, isGuest);

  /**
   * Auth synchronization
   *
   * The old page checked auth once. This version also listens for sign-in,
   * sign-out, and session restoration so the page cannot remain stuck in
   * guest mode after authentication changes.
   */
  useEffect(() => {
    let active = true;

    const applySession = (session: {
      user: { id: string } | null;
    } | null) => {
      if (!active || !mountedRef.current) {
        return;
      }

      // Invalidate any in-flight data request belonging to a previous user.
      loadRequestIdRef.current += 1;

      if (session?.user) {
        setUserId(session.user.id);
        setIsGuest(false);
      } else {
        setUserId(null);
        setIsGuest(true);
      }

      setWeekTasks([]);
      setSubjects([]);
      setStreak(0);
      setActiveTask(null);
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch((error) => {
        console.error("Error restoring auth session:", error);

        if (!active || !mountedRef.current) {
          return;
        }

        setUserId(null);
        setIsGuest(true);
        setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Load authenticated user data.
   *
   * The overall structure is intentionally kept close to the original:
   * no migration to another state library, no changes to child components,
   * and no speculative backend behavior.
   */
  const loadData = useCallback(async () => {
    if (!userId || !mountedRef.current) {
      return;
    }

    const requestId = ++loadRequestIdRef.current;

    setLoading(true);

    try {
      // -----------------------------
      // Subjects
      // -----------------------------
      const {
        data: subjectsData,
        error: subjectsError,
      } = await supabase
        .from("study_subjects")
        .select("*")
        .eq("user_id", userId)
        .order("priority_order");

      if (subjectsError) {
        throw subjectsError;
      }

      if (
        requestId !== loadRequestIdRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      setSubjects(subjectsData || []);

      // -----------------------------
      // Current week
      // -----------------------------
      const now = new Date();

      const weekStart = format(
        startOfWeek(now, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      );

      const weekEnd = format(
        endOfWeek(now, { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      );

      const {
        data: weekData,
        error: weekError,
      } = await supabase
        .from("study_tasks")
        .select(`
          id,
          topic,
          duration_minutes,
          difficulty,
          status,
          task_date,
          study_subjects (
            subject_name,
            icon_name,
            color
          )
        `)
        .eq("user_id", userId)
        .gte("task_date", weekStart)
        .lte("task_date", weekEnd);

      if (weekError) {
        throw weekError;
      }

      if (
        requestId !== loadRequestIdRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      const formattedWeekTasks: WeekTask[] = ((weekData || []) as any[]).map(
        (task) => ({
          id: task.id,
          subject_name:
            task.study_subjects?.subject_name || "Unknown",
          icon_name:
            task.study_subjects?.icon_name || "book",
          color:
            task.study_subjects?.color || "#3b82f6",
          topic: task.topic,
          duration_minutes: task.duration_minutes,
          difficulty: task.difficulty,
          status: task.status,
          task_date: task.task_date,
        })
      );

      setWeekTasks(formattedWeekTasks);

      // -----------------------------
      // Today's tasks
      // -----------------------------
      const today = format(now, "yyyy-MM-dd");

      if (!isCacheValid) {
        const {
          data: tasksData,
          error: tasksError,
        } = await supabase
          .from("study_tasks")
          .select(`
            id,
            topic,
            duration_minutes,
            difficulty,
            status,
            study_subjects (
              subject_name,
              icon_name,
              color
            )
          `)
          .eq("user_id", userId)
          .eq("task_date", today);

        if (tasksError) {
          throw tasksError;
        }

        if (
          requestId !== loadRequestIdRef.current ||
          !mountedRef.current
        ) {
          return;
        }

        const formattedTasks: StudyTaskData[] = (
          tasksData || []
        ).map((task: any) => ({
          id: task.id,
          subject_name:
            task.study_subjects?.subject_name || "Unknown",
          icon_name:
            task.study_subjects?.icon_name || "book",
          color:
            task.study_subjects?.color || "#3b82f6",
          topic: task.topic,
          duration_minutes: task.duration_minutes,
          difficulty: task.difficulty,
          status: task.status,
        }));

        saveTasks(formattedTasks);
      }

      // -----------------------------
      // Study streak
      // -----------------------------
      const {
        data: habitData,
        error: habitError,
      } = await supabase
        .from("habits")
        .select("current_streak")
        .eq("user_id", userId)
        .eq("habit_type", "study")
        .maybeSingle();

      if (habitError) {
        throw habitError;
      }

      if (
        requestId !== loadRequestIdRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      setStreak(habitData?.current_streak || 0);
    } catch (error) {
      if (
        requestId !== loadRequestIdRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      console.error("Error loading study coach data:", error);

      toast({
        title: "Couldn't load your study data",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      if (
        requestId === loadRequestIdRef.current &&
        mountedRef.current
      ) {
        setLoading(false);
      }
    }
  }, [userId, isCacheValid, saveTasks, toast]);

  /**
   * Load authenticated data whenever the authenticated user changes.
   *
   * Guest mode deliberately uses local demo data instead.
   */
  useEffect(() => {
    if (userId) {
      loadData();
      return;
    }

    if (isGuest) {
      setSubjects(DEMO_SUBJECTS);
      saveTasks(DEMO_TASKS);
      setWeekTasks([]);
      setStreak(3);
      setLoading(false);
    }
  }, [userId, isGuest, loadData, saveTasks]);

  /**
   * Reset the selected day when a newly authenticated session begins.
   */
  useEffect(() => {
    setSelectedDate(format(new Date(), "yyyy-MM-dd"));
  }, [userId]);

  const handleAddSubject = useCallback(
    async (subject: Omit<Subject, "id">) => {
      if (isGuest) {
        const newSubject: Subject = {
          ...subject,
          id: `demo-${Date.now()}`,
        };

        setSubjects((current) => [...current, newSubject]);

        toast({
          title: "Subject added (demo mode)",
        });

        return;
      }

      if (!userId) {
        return;
      }

      const { error } = await supabase
        .from("study_subjects")
        .insert({
          user_id: userId,
          ...subject,
          priority_order: subjects.length + 1,
        });

      if (error) {
        console.error("Error adding subject:", error);

        toast({
          title: "Error",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });

        return;
      }

      toast({
        title: "Subject added",
      });

      await loadData();
    },
    [
      isGuest,
      userId,
      subjects.length,
      loadData,
      toast,
    ]
  );

  const handleDeleteSubject = useCallback(
    async (id: string) => {
      if (isGuest) {
        setSubjects((current) =>
          current.filter((subject) => subject.id !== id)
        );

        toast({
          title: "Subject deleted (demo mode)",
        });

        return;
      }

      if (!userId) {
        return;
      }

      const { error } = await supabase
        .from("study_subjects")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting subject:", error);

        toast({
          title: "Error",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });

        return;
      }

      toast({
        title: "Subject deleted",
      });

      await loadData();
    },
    [isGuest, userId, loadData, toast]
  );

  const handleGeneratePlan = useCallback(
    async (duration: PlanDuration = "daily") => {
      if (isGuest) {
        toast({
          title: "Sign in to generate plans",
          description:
            "Create a free account to use AI-powered study planning.",
        });

        setAuthDialogOpen(true);
        return;
      }

      if (!userId || subjects.length === 0) {
        toast({
          title: "Add subjects first",
          description:
            "Add at least one subject to generate a study plan.",
          variant: "destructive",
        });

        return;
      }

      if (generating) {
        return;
      }

      setGenerating(true);

      try {
        const { data, error } =
          await supabase.functions.invoke("study-coach", {
            body: {
              action: "generate-daily-plan",
              userId,
              duration,
            },
          });

        if (error) {
          throw error;
        }

        clearCache();
        setHasGeneratedOnce(true);

        const daysLabel =
          duration === "monthly"
            ? "30 days"
            : duration === "weekly"
              ? "7 days"
              : "today";

        toast({
          title: "Plan generated!",
          description: `Created ${data?.tasksCreated || 0} tasks for ${daysLabel}.`,
        });

        await loadData();
      } catch (error) {
        console.error("Error generating plan:", error);

        toast({
          title: "Couldn't generate plan",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });
      } finally {
        if (mountedRef.current) {
          setGenerating(false);
        }
      }
    },
    [
      isGuest,
      userId,
      subjects.length,
      generating,
      clearCache,
      loadData,
      toast,
    ]
  );

  /**
   * Auto-generate only when:
   * - the authenticated data has actually finished loading
   * - subjects exist
   * - there are no today's cached tasks
   * - the current week has no tasks at all
   *
   * The week check prevents cache state alone from accidentally triggering
   * another plan generation when an existing weekly plan is already present.
   */
  useEffect(() => {
    if (
      loading ||
      !userId ||
      subjects.length === 0 ||
      cachedTasks.length > 0 ||
      weekTasks.length > 0 ||
      generating ||
      hasGeneratedOnce ||
      autoGenerateAttempted.current
    ) {
      return;
    }

    autoGenerateAttempted.current = true;
    void handleGeneratePlan("weekly");
  }, [
    loading,
    userId,
    subjects.length,
    cachedTasks.length,
    weekTasks.length,
    generating,
    hasGeneratedOnce,
    handleGeneratePlan,
  ]);

  /**
   * Update the local weekly copy whenever today's task changes.
   * This keeps the WeekRibbon from lagging behind cachedTasks.
   */
  const updateWeekTaskStatus = useCallback(
    (
      taskId: string,
      status: StudyTaskData["status"]
    ) => {
      setWeekTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? { ...task, status }
            : task
        )
      );
    },
    []
  );

  /**
   * Resolve a task consistently from the two task sources used by this page.
   */
  const findTask = useCallback(
    (taskId: string) => {
      return (
        cachedTasks.find((task) => task.id === taskId) ||
        weekTasks.find((task) => task.id === taskId)
      );
    },
    [cachedTasks, weekTasks]
  );

  const handleStartTask = useCallback(
    (taskId: string) => {
      const task = findTask(taskId);

      if (!task) {
        return;
      }

      updateTaskLocally(taskId, {
        status: "in_progress",
      });

      updateWeekTaskStatus(taskId, "in_progress");

      setActiveTask({
        id: task.id,
        subject_name: task.subject_name,
        icon_name: task.icon_name,
        color: task.color,
        topic: task.topic,
        duration_minutes: task.duration_minutes,
        difficulty: task.difficulty,
      });

      /**
       * Guest tasks are local demo tasks and must never be sent to Supabase.
       */
      if (!userId || isGuest) {
        return;
      }

      void supabase
        .from("study_tasks")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) {
            console.error("Error syncing task start:", error);
          }
        });

      void supabase
        .from("leaderboard_opt_ins")
        .update({ is_studying: true })
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) {
            console.error(
              "Error updating study presence:",
              error
            );
          }
        });
    },
    [
      findTask,
      updateTaskLocally,
      updateWeekTaskStatus,
      userId,
      isGuest,
    ]
  );

  const handleTaskComplete = useCallback(
    async (
      taskId: string,
      status: CompletionStatus,
      actualMinutes: number
    ) => {
      if (!userId && !isGuest) {
        return;
      }

      const task = findTask(taskId);

      if (!task) {
        return;
      }

      updateTaskLocally(taskId, {
        status,
        actual_minutes: actualMinutes,
      });

      updateWeekTaskStatus(taskId, status);

      setActiveTask(null);

      if (userId && !isGuest) {
        void supabase
          .from("leaderboard_opt_ins")
          .update({ is_studying: false })
          .eq("user_id", userId)
          .then(({ error }) => {
            if (error) {
              console.error(
                "Error clearing study presence:",
                error
              );
            }
          });
      }

      if (status === "completed") {
        toast({
          title: "Task completed! 🎉",
        });
      } else if (status === "partial") {
        toast({
          title: "Partial credit logged",
          description: "Keep going tomorrow!",
        });
      } else {
        toast({
          title: "Task skipped",
          variant: "destructive",
        });
      }

      /**
       * Guest completion stays completely local.
       */
      if (isGuest || !userId) {
        return;
      }

      let syncHadError = false;

      // -----------------------------
      // Task completion sync
      // -----------------------------
      try {
        const completedAt =
          status === "completed"
            ? new Date().toISOString()
            : null;

        const { error: taskUpdateError } =
          await supabase
            .from("study_tasks")
            .update({
              status,
              completed_at: completedAt,
            })
            .eq("id", taskId)
            .eq("user_id", userId);

        if (taskUpdateError) {
          throw taskUpdateError;
        }
      } catch (error) {
        syncHadError = true;
        console.error(
          "Error syncing task completion:",
          error
        );
      }

      // -----------------------------
      // Study session
      // -----------------------------
      try {
        const subjectData = subjects.find(
          (subject) =>
            subject.subject_name === task.subject_name
        );

        if (subjectData) {
          const { error: sessionError } =
            await supabase
              .from("study_sessions")
              .insert({
                user_id: userId,
                subject_id: subjectData.id,
                task_id: taskId,
                topic: task.topic,
                time_spent_minutes: actualMinutes,
                session_date: format(
                  new Date(),
                  "yyyy-MM-dd"
                ),
              });

          if (sessionError) {
            throw sessionError;
          }
        }
      } catch (error) {
        syncHadError = true;
        console.error(
          "Error recording study session:",
          error
        );
      }

      // -----------------------------
      // Study streak
      // -----------------------------
      try {
        if (status === "completed") {
          const {
            data: habit,
            error: habitReadError,
          } = await supabase
            .from("habits")
            .select("*")
            .eq("user_id", userId)
            .eq("habit_type", "study")
            .maybeSingle();

          if (habitReadError) {
            throw habitReadError;
          }

          const today = format(
            new Date(),
            "yyyy-MM-dd"
          );

          const yesterday = format(
            subDays(new Date(), 1),
            "yyyy-MM-dd"
          );

          if (habit) {
            const lastDate = habit.last_completed_date;
            const isConsecutive =
              lastDate === yesterday;
            const isSameDay = lastDate === today;

            if (!isSameDay) {
              const newStreak = isConsecutive
                ? (habit.current_streak || 0) + 1
                : 1;

              const { error: streakUpdateError } =
                await supabase
                  .from("habits")
                  .update({
                    current_streak: newStreak,
                    longest_streak: Math.max(
                      newStreak,
                      habit.longest_streak || 0
                    ),
                    last_completed_date: today,
                    total_completions:
                      (habit.total_completions || 0) + 1,
                  })
                  .eq("id", habit.id)
                  .eq("user_id", userId);

              if (streakUpdateError) {
                throw streakUpdateError;
              }

              setStreak(newStreak);
            }
          } else {
            const { error: createHabitError } =
              await supabase
                .from("habits")
                .insert({
                  user_id: userId,
                  habit_type: "study",
                  current_streak: 1,
                  longest_streak: 1,
                  last_completed_date: today,
                  total_completions: 1,
                });

            if (createHabitError) {
              throw createHabitError;
            }

            setStreak(1);
          }
        } else if (status === "skipped") {
          const {
            data: habit,
            error: habitReadError,
          } = await supabase
            .from("habits")
            .select("*")
            .eq("user_id", userId)
            .eq("habit_type", "study")
            .maybeSingle();

          if (habitReadError) {
            throw habitReadError;
          }

          if (habit) {
            const { error: streakResetError } =
              await supabase
                .from("habits")
                .update({ current_streak: 0 })
                .eq("id", habit.id)
                .eq("user_id", userId);

            if (streakResetError) {
              throw streakResetError;
            }

            setStreak(0);
          }
        }
      } catch (error) {
        syncHadError = true;
        console.error(
          "Error updating study streak:",
          error
        );
      }

      if (syncHadError) {
        toast({
          title: "Saved locally, but sync had an issue",
          description:
            "Your study state was updated on this device. Some server data may need refreshing.",
          variant: "destructive",
        });
      }

      refreshProgress();
    },
    [
      userId,
      isGuest,
      findTask,
      updateTaskLocally,
      updateWeekTaskStatus,
      subjects,
      toast,
      refreshProgress,
    ]
  );

  const handleMarkDone = useCallback(
    async (taskId: string) => {
      const task = findTask(taskId);

      if (!task) {
        return;
      }

      await handleTaskComplete(
        taskId,
        "completed",
        task.duration_minutes
      );
    },
    [findTask, handleTaskComplete]
  );

  const handleSkipTask = useCallback(
    async (taskId: string) => {
      const task = findTask(taskId);

      if (!task) {
        return;
      }

      await handleTaskComplete(taskId, "skipped", 0);
    },
    [findTask, handleTaskComplete]
  );

  const handleCancelTask = useCallback(() => {
    if (!activeTask) {
      return;
    }

    const taskId = activeTask.id;

    updateTaskLocally(taskId, {
      status: "pending",
    });

    updateWeekTaskStatus(taskId, "pending");

    setActiveTask(null);

    toast({
      title: "Task cancelled",
    });

    /**
     * Demo task cancellation is completely local.
     */
    if (!userId || isGuest) {
      return;
    }

    void supabase
      .from("study_tasks")
      .update({
        status: "pending",
        started_at: null,
      })
      .eq("id", taskId)
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) {
          console.error(
            "Error syncing task cancellation:",
            error
          );
        }
      });
  }, [
    activeTask,
    updateTaskLocally,
    updateWeekTaskStatus,
    toast,
    userId,
    isGuest,
  ]);

  const handleAdjustPlan = useCallback(
    async (
      mode: "less_time" | "tired" | "push_harder"
    ) => {
      if (isGuest) {
        toast({
          title: "Sign in to adjust plans",
          description:
            "Create a free account to use AI plan adjustments.",
        });

        setAuthDialogOpen(true);
        return;
      }

      if (!userId || adjusting) {
        return;
      }

      setAdjusting(true);
      setAdjustOpen(false);

      try {
        const { error } =
          await supabase.functions.invoke("study-coach", {
            body: {
              action: "adjust-plan",
              userId,
              mode,
            },
          });

        if (error) {
          throw error;
        }

        clearCache();

        toast({
          title: "Plan adjusted!",
        });

        await loadData();
        refreshProgress();
      } catch (error) {
        console.error(
          "Error adjusting plan:",
          error
        );

        toast({
          title: "Couldn't adjust plan",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });
      } finally {
        if (mountedRef.current) {
          setAdjusting(false);
        }
      }
    },
    [
      isGuest,
      userId,
      adjusting,
      clearCache,
      loadData,
      refreshProgress,
      toast,
    ]
  );

  /**
   * Task-derived values
   */
  const pendingTasks = useMemo(
    () =>
      cachedTasks.filter(
        (task) =>
          task.status === "pending" ||
          task.status === "in_progress"
      ),
    [cachedTasks]
  );

  const completedTasks = useMemo(
    () =>
      cachedTasks.filter(
        (task) => task.status === "completed"
      ),
    [cachedTasks]
  );

  const nextTask = pendingTasks[0];
  const otherTasks = pendingTasks.slice(1);

  const pendingMinutes = useMemo(
    () =>
      pendingTasks.reduce(
        (sum, task) => sum + task.duration_minutes,
        0
      ),
    [pendingTasks]
  );

  /**
   * Keep these values intentionally calculated even though some are currently
   * consumed by imported child components only in future variations.
   * Avoid changing the existing data contract unnecessarily.
   */
  void completedTasks;
  void nextTask;
  void otherTasks;
  void pendingMinutes;

  /**
   * Week ribbon data.
   */
  const weekPerDay = useMemo(() => {
    const map = new Map<
      string,
      { total: number; done: number }
    >();

    weekTasks.forEach((task) => {
      const entry =
        map.get(task.task_date) || {
          total: 0,
          done: 0,
        };

      entry.total += 1;

      if (task.status === "completed") {
        entry.done += 1;
      }

      map.set(task.task_date, entry);
    });

    return Array.from(map.entries()).map(
      ([date, value]) => ({
        date,
        ...value,
      })
    );
  }, [weekTasks]);

  /**
   * Normalize the current local date separately from the selected calendar
   * date. This also allows the page to stay open across midnight safely.
   */
  const today = format(new Date(), "yyyy-MM-dd");

  const isToday = selectedDate === today;

  const selectedDateObject = useMemo(
    () =>
      parse(
        selectedDate,
        "yyyy-MM-dd",
        new Date()
      ),
    [selectedDate]
  );

  /**
   * Today uses the instant local cache. Other days use the current-week
   * database snapshot.
   */
  const dayTasks: StudyTaskData[] = isToday
    ? cachedTasks
    : weekTasks.filter(
        (task) => task.task_date === selectedDate
      );

  /**
   * Responsive screen behavior:
   * - `100dvh` handles mobile browser viewport changes better than `100vh`.
   * - Safe-area bottom padding avoids controls sitting behind mobile browser
   *   UI or device insets.
   */
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Loading Study Coach"
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
      <div className="mx-auto flex min-h-[calc(100dvh-80px)] w-full min-w-0 max-w-6xl flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-8">
        {/* Header */}
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-foreground">
              {format(new Date(), "EEEE")}
            </div>

            <div className="truncate text-xs leading-tight text-muted-foreground">
              {format(new Date(), "MMMM d")}

              {streak > 0 && (
                <span className="font-semibold text-orange-500">
                  {" "}
                  · 🔥 {streak} day streak
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <div
              aria-label="Study music"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"
            >
              <BackgroundMusicPlayer compact />
            </div>

            {studyMode === "plan" && (
              <button
                type="button"
                aria-label="Manage subjects"
                title="Manage subjects"
                onClick={() =>
                  setSubjectsOpen(true)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card tap-effect transition-colors hover:border-primary/40"
              >
                <BookOpen className="h-4 w-4 text-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Mode Toggle */}
        {!activeTask && (
          <div className="mb-4 flex justify-center">
            <div
              role="tablist"
              aria-label="Study Coach sections"
              className="grid w-full max-w-sm grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5"
            >
              {[
                {
                  mode: "timer" as const,
                  label: "Focus",
                  icon: Timer,
                },
                {
                  mode: "plan" as const,
                  label: "Blueprint",
                  icon: ClipboardList,
                },
                {
                  mode: "stats" as const,
                  label: "Stats",
                  icon: ChartNoAxesColumnIncreasing,
                },
              ].map((tab) => {
                const isActive =
                  studyMode === tab.mode;

                return (
                  <button
                    key={tab.mode}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setStudyMode(tab.mode);

                      if (
                        typeof navigator !==
                          "undefined" &&
                        "vibrate" in navigator
                      ) {
                        navigator.vibrate?.(10);
                      }
                    }}
                    className={cn(
                      "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Guest Banner */}
        <GuestBanner isGuest={isGuest} />

        {/* Active Task */}
        {activeTask && (
          <div className="flex min-h-0 flex-1 flex-col">
            <StudyTaskTimer
              task={activeTask}
              onComplete={handleTaskComplete}
              onCancel={handleCancelTask}
            />
          </div>
        )}

        {/* Focus Mode */}
        {!activeTask && studyMode === "timer" && (
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <FocusCockpit
              userId={userId}
              streak={streak}
              todayMinutes={progress.todayMinutes}
              level={progress.level}
              xpInLevel={progress.xpInLevel}
              xpForLevel={progress.xpForLevel}
              dailyGoalMinutes={
                progress.dailyGoalMinutes
              }
              onSessionLogged={({
                minutes,
                intent,
                distractions,
                focusScore,
              }) => {
                toast({
                  title: "Session complete! 🎉",
                  description: `${minutes}m · Focus ${focusScore} · ${distractions} distractions`,
                });

                if (!userId || isGuest) {
                  return;
                }

                void supabase
                  .from("study_sessions")
                  .insert({
                    user_id: userId,
                    topic:
                      intent || "Focus session",
                    time_spent_minutes: minutes,
                    notes: encodeSessionNote({
                      intent,
                      distractions,
                      focusScore,
                    }),
                  })
                  .then(({ error }) => {
                    if (error) {
                      console.error(
                        "Error saving focus session:",
                        error
                      );

                      toast({
                        title:
                          "Session saved locally",
                        description:
                          "The server couldn't record the session.",
                        variant: "destructive",
                      });

                      return;
                    }

                    refreshProgress();
                  });
              }}
            />
          </div>
        )}

        {/* AI Chat */}
        {!activeTask &&
          studyMode === "timer" &&
          userId &&
          !isGuest && (
            <FloatingAIChat anchor="ring" />
          )}

        {!activeTask &&
          studyMode === "plan" &&
          userId &&
          !isGuest && (
            <FloatingAIChat anchor="blueprint" />
          )}

        {/* Blueprint Mode */}
        {!activeTask &&
          studyMode === "plan" && (
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Progress */}
                {!isGuest && (
                  <LifeProgress
                    progress={progress}
                    streak={streak}
                  />
                )}

                {/* Week Ribbon */}
                <div className="mt-3 shrink-0">
                  <WeekRibbon
                    selectedDate={selectedDate}
                    onSelect={setSelectedDate}
                    perDay={weekPerDay}
                  />
                </div>

                {/* Selected Day Header */}
                {dayTasks.length > 0 && (
                  <div className="mt-3 mb-1 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-foreground">
                        {isToday
                          ? "Today's path"
                          : format(
                              selectedDateObject,
                              "EEEE, MMM d"
                            )}
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {
                          dayTasks.filter(
                            (task) =>
                              task.status ===
                              "completed"
                          ).length
                        }{" "}
                        / {dayTasks.length} done ·{" "}
                        {dayTasks.reduce(
                          (sum, task) =>
                            sum +
                            task.duration_minutes,
                          0
                        )}
                        m total
                      </div>
                    </div>

                    {isToday &&
                      cachedTasks.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setAdjustOpen(true)
                          }
                          disabled={adjusting}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold tap-effect hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sliders className="h-3 w-3" />
                          {adjusting
                            ? "Adjusting..."
                            : "Adjust"}
                        </button>
                      )}
                  </div>
                )}

                {/* Study Path / Empty States */}
                <div className="flex min-h-0 flex-1 flex-col py-2">
                  {dayTasks.length > 0 ? (
                    <StudyPath
                      tasks={dayTasks}
                      onStart={
                        isToday
                          ? handleStartTask
                          : undefined
                      }
                      onMarkDone={
                        isToday
                          ? handleMarkDone
                          : undefined
                      }
                      onSkip={
                        isToday
                          ? handleSkipTask
                          : undefined
                      }
                    />
                  ) : (
                    <>
                      {isToday &&
                      cachedTasks.length === 0 ? (
                        <div className="mx-auto w-full max-w-sm text-center py-6">
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 sm:h-20 sm:w-20">
                            <Sparkles className="h-7 w-7 text-primary sm:h-10 sm:w-10" />
                          </div>

                          <h3 className="mb-2 text-lg font-bold text-foreground sm:text-xl">
                            Ready to study?
                          </h3>

                          <p className="mx-auto mb-5 max-w-xs text-xs text-muted-foreground sm:text-sm">
                            {subjects.length ===
                            0
                              ? "Add your subjects first, then generate an AI study plan."
                              : "Generate an AI-powered study plan tailored to your goals."}
                          </p>

                          {subjects.length >
                          0 ? (
                            <PlanDurationSelector
                              onGenerate={
                                handleGeneratePlan
                              }
                              isLoading={
                                generating
                              }
                              hasExistingPlan={
                                false
                              }
                            />
                          ) : (
                            <Button
                              type="button"
                              onClick={() =>
                                setSubjectsOpen(
                                  true
                                )
                              }
                              className="gap-2"
                            >
                              <BookOpen className="h-4 w-4" />
                              Add Subjects
                            </Button>
                          )}
                        </div>
                      ) : isToday &&
                        pendingTasks.length ===
                          0 &&
                        cachedTasks.length >
                          0 ? (
                        <div className="mx-auto w-full max-w-sm space-y-3 py-4 text-center">
                          <div className="mb-1 text-5xl">
                            🏆
                          </div>

                          <h3 className="text-lg font-bold text-foreground">
                            You crushed it!
                          </h3>

                          <p className="text-xs text-muted-foreground">
                            All tasks done. But
                            legends don't stop
                            here.
                          </p>

                          <div className="mx-auto max-w-xs rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-4">
                            <div className="mb-2 flex items-center justify-center gap-1.5">
                              <Zap className="h-4 w-4 text-primary" />
                              <p className="text-sm font-bold text-foreground">
                                Break The Rules
                              </p>
                              <Zap className="h-4 w-4 text-primary" />
                            </div>

                            <p className="mb-3 text-[11px] text-muted-foreground">
                              Beyond plan ={" "}
                              <span className="font-bold text-primary">
                                1.5x XP
                              </span>
                            </p>

                            <div className="flex justify-center gap-2">
                              {[15, 25, 45].map(
                                (minutes) => (
                                  <button
                                    key={
                                      minutes
                                    }
                                    type="button"
                                    disabled={
                                      isGuest
                                    }
                                    className="flex flex-col items-center gap-0.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 transition-all hover:bg-primary/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={() => {
                                      if (
                                        isGuest
                                      ) {
                                        toast({
                                          title:
                                            "Sign up for bonus rounds",
                                        });
                                        setAuthDialogOpen(
                                          true
                                        );
                                        return;
                                      }

                                      if (
                                        !userId
                                      ) {
                                        return;
                                      }

                                      const subject =
                                        subjects[0];

                                      if (
                                        !subject
                                      ) {
                                        toast({
                                          title:
                                            "Add a subject first",
                                          variant:
                                            "destructive",
                                        });
                                        return;
                                      }

                                      void supabase
                                        .from(
                                          "study_sessions"
                                        )
                                        .insert({
                                          user_id:
                                            userId,
                                          subject_id:
                                            subject.id,
                                          topic:
                                            "Bonus Session",
                                          time_spent_minutes:
                                            minutes,
                                          session_date:
                                            format(
                                              new Date(),
                                              "yyyy-MM-dd"
                                            ),
                                          is_bonus:
                                            true,
                                        })
                                        .then(
                                          ({
                                            error,
                                          }) => {
                                            if (
                                              error
                                            ) {
                                              console.error(
                                                "Error logging bonus session:",
                                                error
                                              );

                                              toast(
                                                {
                                                  title:
                                                    "Couldn't log bonus session",
                                                  description:
                                                    getUserFriendlyError(
                                                      error
                                                    ),
                                                  variant:
                                                    "destructive",
                                                }
                                              );

                                              return;
                                            }

                                            toast(
                                              {
                                                title: `Bonus +${minutes}min logged! 🔥`,
                                                description:
                                                  "1.5x XP earned",
                                              }
                                            );

                                            refreshProgress();
                                          }
                                        );
                                    }}
                                  >
                                    <span className="text-lg">
                                      ⚡
                                    </span>
                                    <span className="text-sm font-bold text-primary">
                                      {minutes}m
                                    </span>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                          No tasks scheduled
                          for this day.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Stats Mode */}
        {!activeTask &&
          studyMode === "stats" && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <StudyAnalytics
                userId={userId}
                isGuest={isGuest}
              />
            </div>
          )}

        {/* Subjects Dialog */}
        <Dialog
          open={subjectsOpen}
          onOpenChange={setSubjectsOpen}
        >
          <DialogContent className="max-h-[80vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Manage Subjects
              </DialogTitle>
            </DialogHeader>

            <SubjectManager
              subjects={subjects}
              onAdd={handleAddSubject}
              onDelete={handleDeleteSubject}
            />
          </DialogContent>
        </Dialog>

        {/* Adjust Plan */}
        <PlanAdjusterSheet
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          onApplied={() => {
            clearCache();
            void loadData();
            refreshProgress();
          }}
        />

        {/* Authentication */}
        <Dialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
        >
          <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-0">
            <Auth />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}