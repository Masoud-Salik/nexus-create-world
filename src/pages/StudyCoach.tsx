import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Loader2, LogIn, Sparkles, BookOpen, Sliders, RefreshCw, Target, Timer, Zap, Play, Clock as ClockIcon, CheckCircle2 } from "lucide-react";
import { StudyAnalytics } from "@/components/study-coach/StudyAnalytics";
import { StudyTaskData } from "@/components/study-coach/TaskCard";
import { StudyTaskTimer, ActiveTask, CompletionStatus } from "@/components/study-coach/StudyTaskTimer";
import { SubjectManager } from "@/components/study-coach/SubjectManager";
import { PlanDurationSelector, PlanDuration } from "@/components/study-coach/PlanDurationSelector";
import { PomodoroTimer } from "@/components/study-coach/PomodoroTimer";
import { useLocalStudyPlan } from "@/hooks/useLocalStudyPlan";
import { BackgroundMusicPlayer } from "@/components/study-coach/BackgroundMusicPlayer";
import { FloatingAIChat } from "@/components/study-coach/FloatingAIChat";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Book, Calculator, Atom, Globe, Music as MusicIcon, Pen } from "lucide-react";

const taskIconMap: Record<string, any> = {
  book: Book, "book-open": Book, calculator: Calculator, atom: Atom, flask: Atom, globe: Globe, music: MusicIcon, pen: Pen,
};

const difficultyConfig: Record<string, { emoji: string; label: string; color: string }> = {
  easy: { emoji: "⚡", label: "Easy", color: "bg-emerald-500/20 text-emerald-400" },
  medium: { emoji: "💪", label: "Medium", color: "bg-yellow-500/20 text-yellow-400" },
  hard: { emoji: "🔥", label: "Hard", color: "bg-red-500/20 text-red-400" },
};

type StudyMode = "timer" | "plan" | "stats";

// Auto-hiding guest banner component
function GuestBanner({ isGuest }: {isGuest: boolean;}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (isGuest) {
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isGuest]);

  if (!isGuest || !visible) return null;

  return (
    <Link
      to="/chat"
      className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 mb-3 tap-effect transition-opacity">
      
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-foreground">Demo Mode</span>
      <LogIn className="h-4 w-4 text-primary ml-auto" />
    </Link>);

}

interface Subject {
  id: string;
  subject_name: string;
  icon_name: string;
  color: string;
  weekly_target_minutes: number;
}

// Adjust options for SmartAdjust dialog
const adjustOptions = [
  { mode: "less_time" as const, emoji: "⏰", title: "Less time", desc: "Shorter sessions", bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-600 dark:text-blue-400" },
  { mode: "tired" as const, emoji: "😴", title: "I'm tired", desc: "Lower difficulty", bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-600 dark:text-yellow-400" },
  { mode: "push_harder" as const, emoji: "🔥", title: "Push harder", desc: "More challenge", bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-600 dark:text-red-400" },
];


export default function StudyCoach() {
  usePageMeta({ title: "Study Coach", description: "AI-powered study planning" });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  // Mode toggle: "timer" (Pomodoro) or "plan" (AI tasks)
  const [studyMode, setStudyMode] = useState<StudyMode>("timer");

  // Dialog states for icon buttons
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  // Active timer state
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);

  // Data states
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streak, setStreak] = useState(0);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const autoGenerateAttempted = useRef(false);

  // Local caching for instant updates
  const { cachedTasks, isCacheValid, saveTasks, updateTaskLocally, clearCache } = useLocalStudyPlan(userId);

  // Demo data for guest users
  const demoSubjects: Subject[] = [
  { id: "demo-1", subject_name: "Mathematics", icon_name: "calculator", color: "#3b82f6", weekly_target_minutes: 300 },
  { id: "demo-2", subject_name: "Physics", icon_name: "atom", color: "#8b5cf6", weekly_target_minutes: 240 },
  { id: "demo-3", subject_name: "English", icon_name: "book-open", color: "#10b981", weekly_target_minutes: 180 }];


  const demoTasks: StudyTaskData[] = [
  { id: "demo-t1", subject_name: "Mathematics", icon_name: "calculator", color: "#3b82f6", topic: "Calculus - Derivatives", duration_minutes: 45, difficulty: "medium", status: "pending" },
  { id: "demo-t2", subject_name: "Physics", icon_name: "atom", color: "#8b5cf6", topic: "Quantum Mechanics Basics", duration_minutes: 30, difficulty: "hard", status: "pending" },
  { id: "demo-t3", subject_name: "English", icon_name: "book-open", color: "#10b981", topic: "Essay Writing Practice", duration_minutes: 25, difficulty: "easy", status: "completed" }];


  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (userId) {
      loadData();
    } else if (isGuest) {
      setSubjects(demoSubjects);
      saveTasks(demoTasks);
      setStreak(3);
      setLoading(false);
    }
  }, [userId, isGuest]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsGuest(true);
      setLoading(false);
      return;
    }
    setUserId(user.id);
  };

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Load subjects
      const { data: subjectsData } = await supabase.
      from("study_subjects").
      select("*").
      eq("user_id", userId).
      order("priority_order");

      setSubjects(subjectsData || []);

      // Load today's tasks (only if cache is invalid)
      const today = format(new Date(), "yyyy-MM-dd");

      if (!isCacheValid) {
        const { data: tasksData } = await supabase.
        from("study_tasks").
        select(`
            id, topic, duration_minutes, difficulty, status,
            study_subjects (subject_name, icon_name, color)
          `).
        eq("user_id", userId).
        eq("task_date", today);

        const formattedTasks: StudyTaskData[] = (tasksData || []).map((t: any) => ({
          id: t.id,
          subject_name: t.study_subjects?.subject_name || "Unknown",
          icon_name: t.study_subjects?.icon_name || "book",
          color: t.study_subjects?.color || "#3b82f6",
          topic: t.topic,
          duration_minutes: t.duration_minutes,
          difficulty: t.difficulty,
          status: t.status
        }));

        saveTasks(formattedTasks);
      }

      // Load study streak
      const { data: habitData } = await supabase.
      from("habits").
      select("current_streak").
      eq("user_id", userId).
      eq("habit_type", "study").
      maybeSingle();

      setStreak(habitData?.current_streak || 0);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async (subject: Omit<Subject, "id">) => {
    if (isGuest) {
      const newSubject = { ...subject, id: `demo-${Date.now()}` };
      setSubjects([...subjects, newSubject]);
      toast({ title: "Subject added (demo mode)" });
      return;
    }

    if (!userId) return;

    const { error } = await supabase.from("study_subjects").insert({
      user_id: userId,
      ...subject,
      priority_order: subjects.length + 1
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add subject", variant: "destructive" });
    } else {
      toast({ title: "Subject added" });
      loadData();
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (isGuest) {
      setSubjects(subjects.filter((s) => s.id !== id));
      toast({ title: "Subject deleted (demo mode)" });
      return;
    }

    const { error } = await supabase.from("study_subjects").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete subject", variant: "destructive" });
    } else {
      toast({ title: "Subject deleted" });
      loadData();
    }
  };

  const handleGeneratePlan = async (duration: PlanDuration = "daily") => {
    if (isGuest) {
      toast({
        title: "Sign up to generate plans",
        description: "Create an account to use AI-powered study planning",
        variant: "destructive"
      });
      navigate("/chat");
      return;
    }

    if (!userId || subjects.length === 0) {
      toast({
        title: "Add subjects first",
        description: "Add at least one subject to generate a study plan",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("study-coach", {
        body: { action: "generate-daily-plan", userId, duration }
      });

      if (error) throw error;

      clearCache();
      setHasGeneratedOnce(true);

      const daysLabel = duration === "monthly" ? "30 days" : duration === "weekly" ? "7 days" : "today";
      toast({ title: "Plan generated!", description: `Created ${data?.tasksCreated || 0} tasks for ${daysLabel}` });
      loadData();
    } catch (error) {
      console.error("Error generating plan:", error);
      toast({ title: "Error", description: "Failed to generate plan", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate plan on first visit
  useEffect(() => {
    if (!loading && userId && subjects.length > 0 && cachedTasks.length === 0 && !generating && !hasGeneratedOnce && !autoGenerateAttempted.current) {
      autoGenerateAttempted.current = true;
      handleGeneratePlan("weekly");
    }
  }, [loading, userId, subjects.length, cachedTasks.length, generating, hasGeneratedOnce]);

  const handleStartTask = useCallback((taskId: string) => {
    const task = cachedTasks.find((t) => t.id === taskId);
    if (!task) return;

    updateTaskLocally(taskId, { status: "in_progress" });

    setActiveTask({
      id: task.id,
      subject_name: task.subject_name,
      icon_name: task.icon_name,
      color: task.color,
      topic: task.topic,
      duration_minutes: task.duration_minutes,
      difficulty: task.difficulty
    });

    supabase
      .from("study_tasks")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) console.error("Background sync error:", error);
      });

    // Set is_studying on leaderboard
    if (userId) {
      supabase.from("leaderboard_opt_ins").update({ is_studying: true }).eq("user_id", userId).then(() => {});
    }
  }, [cachedTasks, updateTaskLocally, userId]);

  const handleTaskComplete = useCallback(async (
  taskId: string,
  status: CompletionStatus,
  actualMinutes: number) =>
  {
    if (!userId && !isGuest) return;

    const task = cachedTasks.find((t) => t.id === taskId);
    if (!task) return;

    updateTaskLocally(taskId, { status, actual_minutes: actualMinutes });
    setActiveTask(null);
    // Clear is_studying indicator
    if (userId) { supabase.from("leaderboard_opt_ins").update({ is_studying: false }).eq("user_id", userId).then(() => {}); }

    if (status === "completed") {
      toast({ title: "Task completed! 🎉" });
    } else if (status === "partial") {
      toast({ title: "Partial credit logged", description: "Keep going tomorrow!" });
    } else {
      toast({ title: "Task skipped", variant: "destructive" });
    }

    if (isGuest) return;

    // Background sync
    try {
      await supabase.
      from("study_tasks").
      update({ status, completed_at: new Date().toISOString() }).
      eq("id", taskId);

      const subjectData = subjects.find((s) => s.subject_name === task.subject_name);
      if (subjectData) {
        await supabase.from("study_sessions").insert({
          user_id: userId,
          subject_id: subjectData.id,
          task_id: taskId,
          topic: task.topic,
          time_spent_minutes: actualMinutes,
          session_date: format(new Date(), "yyyy-MM-dd")
        });
      }

      // Update streak for completed tasks
      if (status === "completed") {
        const { data: habit } = await supabase.
        from("habits").
        select("*").
        eq("user_id", userId).
        eq("habit_type", "study").
        maybeSingle();

        const today = format(new Date(), "yyyy-MM-dd");

        if (habit) {
          const lastDate = habit.last_completed_date;
          const isConsecutive = lastDate === format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
          const isSameDay = lastDate === today;

          if (!isSameDay) {
            const newStreak = isConsecutive ? (habit.current_streak || 0) + 1 : 1;
            await supabase.from("habits").update({
              current_streak: newStreak,
              longest_streak: Math.max(newStreak, habit.longest_streak || 0),
              last_completed_date: today,
              total_completions: (habit.total_completions || 0) + 1
            }).eq("id", habit.id);
            setStreak(newStreak);
          }
        } else {
          await supabase.from("habits").insert({
            user_id: userId,
            habit_type: "study",
            current_streak: 1,
            longest_streak: 1,
            last_completed_date: today,
            total_completions: 1
          });
          setStreak(1);
        }
      } else if (status === "skipped") {
        const { data: habit } = await supabase.
        from("habits").
        select("*").
        eq("user_id", userId).
        eq("habit_type", "study").
        maybeSingle();

        if (habit) {
          await supabase.from("habits").update({ current_streak: 0 }).eq("id", habit.id);
          setStreak(0);
        }
      }
    } catch (error) {
      console.error("Background sync error:", error);
    }
  }, [userId, isGuest, cachedTasks, subjects, updateTaskLocally, toast]);

  const handleCancelTask = useCallback(() => {
    if (!activeTask) return;

    updateTaskLocally(activeTask.id, { status: "pending" });
    setActiveTask(null);
    toast({ title: "Task cancelled" });

    supabase.
    from("study_tasks").
    update({ status: "pending", started_at: null }).
    eq("id", activeTask.id).
    then(({ error }) => {
      if (error) console.error("Background sync error:", error);
    });
  }, [activeTask, updateTaskLocally, toast]);

  const handleAdjustPlan = async (mode: "less_time" | "tired" | "push_harder") => {
    if (isGuest) {
      toast({ title: "Sign up to adjust plans", variant: "destructive" });
      return;
    }

    if (!userId) return;

    setAdjusting(true);
    setAdjustOpen(false);

    try {
      const { error } = await supabase.functions.invoke("study-coach", {
        body: { action: "adjust-plan", userId, mode }
      });

      if (error) throw error;

      clearCache();
      toast({ title: "Plan adjusted!" });
      loadData();
    } catch (error) {
      console.error("Error adjusting plan:", error);
      toast({ title: "Error", description: "Failed to adjust plan", variant: "destructive" });
    } finally {
      setAdjusting(false);
    }
  };

  // Calculate stats
  const pendingTasks = cachedTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = cachedTasks.filter((t) => t.status === 'completed');
  const nextTask = pendingTasks[0];
  const otherTasks = pendingTasks.slice(1);
  const pendingMinutes = pendingTasks.reduce((sum, t) => sum + t.duration_minutes, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col min-h-[calc(100vh-80px)]">
        
        {/* Header — date + streak + music */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{format(new Date(), "EEEE, MMMM d")}</span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-orange-500">
                🔥 {streak}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Background Music */}
            <BackgroundMusicPlayer compact />
            {/* Only show management buttons in plan mode */}
            {studyMode === "plan" && <>
                <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setSubjectsOpen(true)}>
                
                  <BookOpen className="h-5 w-5" />
                </Button>
                
                {cachedTasks.length > 0 &&
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setAdjustOpen(true)}
                disabled={adjusting}>
                
                    {adjusting ?
                <RefreshCw className="h-5 w-5 animate-spin" /> :

                <Sliders className="h-5 w-5" />
                }
                  </Button>
              }
              </>
            }
          </div>
        </div>

        {/* Mode Toggle — iOS-style segmented control */}
        {!activeTask && (
          <div className="flex justify-center mb-4">
            <div className="relative flex p-0.5 bg-muted rounded-lg">
              {/* Sliding pill indicator */}
              <div
                className="absolute top-0.5 bottom-0.5 rounded-md bg-primary shadow-md transition-all duration-300 ease-out"
                style={{
                  width: "calc(33.33% - 4px)",
                  left: studyMode === "timer" ? "4px" : studyMode === "plan" ? "calc(33.33%)" : "calc(66.66%)",
                }}
              />
              {([
                { mode: "timer" as const, label: "⏱ Focus" },
                { mode: "plan" as const, label: "📋 Blueprint" },
                { mode: "stats" as const, label: "📊 Stats" },
              ]).map(tab => (
                <button
                  key={tab.mode}
                  onClick={() => { setStudyMode(tab.mode); navigator.vibrate?.(10); }}
                  className={cn(
                    "relative z-10 flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-md transition-colors duration-200",
                    studyMode === tab.mode ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Guest Banner - Auto-hide after 3 seconds */}
        <GuestBanner isGuest={isGuest} />

        {/* Active Timer (full-screen when studying from plan) */}
        {activeTask &&
        <div className="flex-1 flex flex-col min-h-0">
            <StudyTaskTimer
            task={activeTask}
            onComplete={handleTaskComplete}
            onCancel={handleCancelTask} />
          
          </div>
        }

        {/* Pomodoro Timer Mode */}
        {!activeTask && studyMode === "timer" &&
        <div className="flex-1 flex flex-col justify-center">
            <PomodoroTimer
            onSessionComplete={(minutes, focusType) => {
              toast({
                title: "Session complete! 🎉",
                description: `${minutes} minutes of ${focusType} logged`
              });
            }} />
          
          </div>
        }

        {/* Floating AI Chat — Focus & Blueprint */}
        {!activeTask && (studyMode === "timer" || studyMode === "plan") && userId && !isGuest && <FloatingAIChat />}

        {/* Plan Mode Content — Full-screen overlay on mobile */}
        {!activeTask && studyMode === "plan" &&
       <div className="fixed inset-0 bottom-[56px] z-40 bg-background md:relative md:inset-auto md:bottom-auto md:z-auto md:flex-1 flex flex-col overflow-y-auto">
            {/* Mobile header with back button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border md:hidden">
              <h2 className="text-lg font-bold text-foreground">📅 Blueprint</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStudyMode("timer")}
                className="text-muted-foreground"
              >
                ✕ Close
              </Button>
            </div>

            <div className="flex-1 flex flex-col px-4 py-4 md:px-0 md:py-0 max-w-lg mx-auto w-full">
            
            {/* Compact Stats Bar */}
            {cachedTasks.length > 0 &&
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Today's Progress</span>
                  <span className="text-sm font-bold text-foreground">{Math.round(completedTasks.length / cachedTasks.length * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${completedTasks.length / cachedTasks.length * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                    <ClockIcon className="h-3 w-3" /> {pendingMinutes}m left
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 rounded-full text-xs text-primary font-medium">
                    <CheckCircle2 className="h-3 w-3" /> {completedTasks.length}/{cachedTasks.length}
                  </span>
                </div>
              </div>
            }

            {/* Task Cards */}
            <div className="flex-1 flex flex-col py-2 space-y-3">
              
              {nextTask ?
              <>
                {pendingTasks.map((task) => {
                  const Icon = taskIconMap[task.icon_name] || Book;
                  const diff = difficultyConfig[task.difficulty] || difficultyConfig.medium;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/30 transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${task.color}20` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: task.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm">{task.subject_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{task.topic}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <ClockIcon className="h-2.5 w-2.5" /> {task.duration_minutes}m
                          </span>
                          <span className={cn("inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium", diff.color)}>
                            {diff.emoji} {diff.label}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartTask(task.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" /> Start
                      </button>
                    </div>
                  );
                })}
              </> :
            cachedTasks.length === 0 ? (
            /* Empty State - No Tasks */
            <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Ready to study?
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                    {subjects.length === 0 ?
                "Add your subjects first, then generate an AI study plan" :
                "Generate an AI-powered study plan tailored to your goals"
                }
                  </p>
                  
                  {subjects.length > 0 &&
              <PlanDurationSelector
                onGenerate={handleGeneratePlan}
                isLoading={generating}
                hasExistingPlan={false} />

              }
                  
                  {subjects.length === 0 &&
              <Button
                onClick={() => setSubjectsOpen(true)}
                className="gap-2">
                
                      <BookOpen className="h-4 w-4" />
                      Add Subjects
                    </Button>
              }
                </div>) : (

            /* All Tasks Completed — Break The Rules */
            <div className="text-center py-6 space-y-5">
                  <div className="text-6xl mb-2">🏆</div>
                  <h3 className="text-xl font-bold text-foreground">
                    You crushed it!
                  </h3>
                  <p className="text-sm text-muted-foreground">All tasks done. But legends don't stop here.</p>
                  <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-5 mx-auto max-w-xs">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Zap className="h-6 w-6 text-primary" />
                      <p className="font-bold text-lg text-foreground">Break The Rules</p>
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">Go beyond your plan for <span className="font-bold text-primary text-sm">1.5x XP!</span></p>
                    <div className="flex gap-2.5 justify-center">
                      {[15, 25, 45].map(mins => (
                        <button key={mins}
                          className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all"
                          onClick={() => {
                            if (isGuest) { toast({ title: "Sign up for bonus rounds", variant: "destructive" }); return; }
                            if (!userId) return;
                            const subj = subjects[0];
                            if (!subj) return;
                            supabase.from("study_sessions").insert({
                              user_id: userId, subject_id: subj.id, topic: "Bonus Session",
                              time_spent_minutes: mins, session_date: format(new Date(), "yyyy-MM-dd"), is_bonus: true,
                            }).then(() => {
                              toast({ title: `Bonus +${mins}min logged! 🔥`, description: "1.5x XP earned" });
                            });
                          }}>
                          <span className="text-lg">⚡</span>
                          <span className="text-sm font-bold text-primary">{mins}m</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>)
            }
            </div>
            </div>
          </div>
        }

        {/* Subjects Dialog */}
        {/* Stats Mode */}
        {!activeTask && studyMode === "stats" && (
          <div className="flex-1 overflow-y-auto">
            <StudyAnalytics userId={userId} isGuest={isGuest} />
          </div>
        )}

        {/* Subjects Dialog */}
        <Dialog open={subjectsOpen} onOpenChange={setSubjectsOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Subjects</DialogTitle>
            </DialogHeader>
            <SubjectManager
              subjects={subjects}
              onAdd={handleAddSubject}
              onDelete={handleDeleteSubject} />
            
          </DialogContent>
        </Dialog>

        {/* Adjust Plan Dialog */}
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Today's Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {adjustOptions.map((option) =>
              <button
                key={option.mode}
                onClick={() => handleAdjustPlan(option.mode)}
                className={cn("w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left tap-effect", option.bg, option.border, "hover:opacity-80")}>
                
                  <span className="text-2xl">{option.emoji}</span>
                  <div className="flex-1">
                    <p className={cn("font-medium", option.text)}>{option.title}</p>
                    <p className="text-sm text-muted-foreground">{option.desc}</p>
                  </div>
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>);

}