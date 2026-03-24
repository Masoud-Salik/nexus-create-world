import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Loader2, Sparkles, BookOpen, Target, Timer, Trophy } from "lucide-react";
import { StudyTaskTimer } from "@/components/study-coach/StudyTaskTimer";
import { SubjectManager } from "@/components/study-coach/SubjectManager";
import { NextTaskCard } from "@/components/study-coach/NextTaskCard";
import { TaskPills } from "@/components/study-coach/TaskPills";
import { CompactStatsBar } from "@/components/study-coach/CompactStatsBar";
import { PomodoroTimer } from "@/components/study-coach/PomodoroTimer";
import { Leaderboard } from "@/components/study-coach/Leaderboard";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Clock, Battery, Zap } from "lucide-react";

// Import new architecture
import { useAuthStore } from "@/application/stores/authStore";
import { useStudyStore } from "@/application/stores/studyStore";
import { StudyService } from "@/core/domain/services/StudyService";
import { StudyTask, StudyPlan, StudySession } from "@/core/domain/models/Study";

type StudyMode = "timer" | "plan";

const adjustOptions = [
  { mode: "less_time" as const, icon: Clock, title: "Less time", desc: "Shorter sessions" },
  { mode: "tired" as const, icon: Battery, title: "I'm tired", desc: "Lower difficulty" },
  { mode: "push_harder" as const, icon: Zap, title: "Push harder", desc: "More challenge" }
];

export default function StudyCoachRefactored() {
  usePageMeta({ title: "Study Coach", description: "AI-powered study planning" });
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // New architecture state management
  const { user, isAuthenticated } = useAuthStore();
  const { 
    tasks, 
    currentTask, 
    plans, 
    currentPlan, 
    sessions, 
    currentSession,
    subjects,
    timerState,
    setCurrentTask,
    setTasks,
    addTask,
    updateTask,
    setPlans,
    setCurrentPlan,
    addPlan,
    setSubjects,
    setTimerState,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    setLoadingTasks,
    setLoadingPlans
  } = useStudyStore();

  // Component state
  const [studyMode, setStudyMode] = useState<StudyMode>("timer");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);

  // Initialize data
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadUserData = async () => {
    try {
      setLoadingTasks(true);
      setLoadingPlans(true);
      
      // Load user's study data
      // This would use the actual repository implementations
      // For now, we'll simulate the data loading
      
      // Example: Load tasks
      const userTasks = await loadUserTasks(user.id);
      setTasks(userTasks);
      
      // Example: Load plans
      const userPlans = await loadUserPlans(user.id);
      setPlans(userPlans);
      
      // Example: Load subjects
      const userSubjects = await loadUserSubjects(user.id);
      setSubjects(userSubjects);
      
    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Error",
        description: "Failed to load your study data",
        variant: "destructive"
      });
    } finally {
      setLoadingTasks(false);
      setLoadingPlans(false);
      setLoading(false);
    }
  };

  // Mock data loading functions (would be replaced with actual repository calls)
  const loadUserTasks = async (userId: string): Promise<StudyTask[]> => {
    // This would call studyRepository.getTasksByUserId(userId)
    return [];
  };

  const loadUserPlans = async (userId: string): Promise<StudyPlan[]> => {
    // This would call studyRepository.getPlansByUserId(userId)
    return [];
  };

  const loadUserSubjects = async (userId: string) => {
    // This would call studyRepository.getSubjectsByUserId(userId)
    return [];
  };

  // Timer management
  const handleStartSession = useCallback(() => {
    if (currentTask) {
      const duration = studyMode === 'timer' ? 25 * 60 : currentTask.estimated_duration * 60;
      startTimer(duration, studyMode === 'timer' ? 'pomodoro' : 'regular');
    } else {
      toast({
        title: "No Task Selected",
        description: "Please select a task to start studying",
        variant: "destructive"
      });
    }
  }, [currentTask, studyMode, startTimer, toast]);

  const handlePauseSession = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  const handleResumeSession = useCallback(() => {
    resumeTimer();
  }, [resumeTimer]);

  const handleStopSession = useCallback(() => {
    stopTimer();
    // Here you would save the session data
    if (currentSession) {
      // Save session completion
    }
  }, [stopTimer, currentSession]);

  // Task management
  const handleTaskSelect = useCallback((task: StudyTask) => {
    setCurrentTask(task);
  }, [setCurrentTask]);

  const handleTaskComplete = useCallback(async (taskId: string) => {
    try {
      await updateTask(taskId, { 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      });
      
      toast({
        title: "Task Completed!",
        description: "Great job! Keep up the momentum."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive"
      });
    }
  }, [updateTask, toast]);

  // Study plan generation
  const handleGeneratePlan = useCallback(async () => {
    if (!user) return;
    
    setGenerating(true);
    try {
      // This would use the StudyService to generate a plan
      const studyService = new StudyService(/* studyRepository */);
      
      const preferences = {
        user_id: user.id,
        title: "Personal Study Plan",
        duration_days: 7,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        subjects: subjects.map(s => ({
          name: s.name,
          priority: 'medium' as const,
          sessions_per_week: 3,
          session_duration: 45,
          tasks_per_week: 5
        })),
        daily_hours: 4,
        difficulty_preference: 'medium' as const
      };

      const newPlan = await studyService.generateStudyPlan(user.id, preferences);
      addPlan(newPlan);
      setHasGeneratedOnce(true);
      
      toast({
        title: "Study Plan Generated!",
        description: "Your personalized study plan is ready."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate study plan",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  }, [user, subjects, addPlan, toast]);

  // Smart adjust functionality
  const handleSmartAdjust = useCallback((mode: string) => {
    // This would adjust the current plan based on user feedback
    toast({
      title: "Plan Adjusted",
      description: `Study plan adjusted for: ${mode.replace('_', ' ')}`
    });
    setAdjustOpen(false);
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Sparkles className="h-12 w-12 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-2">Welcome to Nexus Study Coach</h2>
        <p className="text-muted-foreground text-center mb-4">
          Sign in to access your personalized study planning and tracking
        </p>
        <Button onClick={() => navigate('/chat')}>
          Get Started
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Study Coach</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name || 'Student'}!
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLeaderboardOpen(true)}
          >
            <Trophy className="h-4 w-4 mr-2" />
            Leaderboard
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSubjectsOpen(true)}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Subjects
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdjustOpen(true)}
          >
            <Target className="h-4 w-4 mr-2" />
            Adjust
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <CompactStatsBar />

      {/* Mode Toggle */}
      <div className="flex bg-muted rounded-lg p-1 mb-6">
        <button
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            studyMode === 'timer' 
              ? 'bg-background shadow-sm' 
              : 'text-muted-foreground'
          }`}
          onClick={() => setStudyMode('timer')}
        >
          <Timer className="h-4 w-4 inline mr-2" />
          Timer Mode
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            studyMode === 'plan' 
              ? 'bg-background shadow-sm' 
              : 'text-muted-foreground'
          }`}
          onClick={() => setStudyMode('plan')}
        >
          <Target className="h-4 w-4 inline mr-2" />
          Plan Mode
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {studyMode === 'timer' ? (
            <PomodoroTimer
              currentTask={currentTask}
              timerState={timerState}
              onStart={handleStartSession}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
              onStop={handleStopSession}
            />
          ) : (
            <div className="space-y-4">
              <NextTaskCard 
                tasks={tasks.filter(t => t.status === 'pending')}
                onTaskSelect={handleTaskSelect}
              />
              <TaskPills 
                tasks={tasks}
                currentTask={currentTask}
                onTaskSelect={handleTaskSelect}
                onTaskComplete={handleTaskComplete}
              />
            </div>
          )}

          {/* Study Timer */}
          <StudyTaskTimer
            currentTask={currentTask}
            timerState={timerState}
            onStart={handleStartSession}
            onPause={handlePauseSession}
            onResume={handleResumeSession}
            onStop={handleStopSession}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current Plan */}
          {currentPlan ? (
            <div className="bg-card rounded-lg border p-4">
              <h3 className="font-semibold mb-2">Current Plan</h3>
              <p className="text-sm text-muted-foreground mb-2">{currentPlan.title}</p>
              <div className="w-full bg-muted rounded-full h-2 mb-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${currentPlan.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {currentPlan.progress}% complete
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border p-4">
              <h3 className="font-semibold mb-2">No Active Plan</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Generate a personalized study plan to get started
              </p>
              <Button 
                onClick={handleGeneratePlan}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {generating ? 'Generating...' : 'Generate Plan'}
              </Button>
            </div>
          )}

          {/* Recent Sessions */}
          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-semibold mb-2">Recent Sessions</h3>
            <div className="space-y-2">
              {sessions.slice(0, 3).map((session) => (
                <div key={session.id} className="text-sm">
                  <p className="font-medium">{session.type}</p>
                  <p className="text-muted-foreground">
                    {format(new Date(session.start_time), 'MMM d, h:mm a')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={subjectsOpen} onOpenChange={setSubjectsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Subjects</DialogTitle>
          </DialogHeader>
          <SubjectManager />
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Your Study Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {adjustOptions.map((option) => (
              <Button
                key={option.mode}
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => handleSmartAdjust(option.mode)}
              >
                <option.icon className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <p className="font-medium">{option.title}</p>
                  <p className="text-sm text-muted-foreground">{option.desc}</p>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leaderboardOpen} onOpenChange={setLeaderboardOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Study Leaderboard</DialogTitle>
          </DialogHeader>
          <Leaderboard />
        </DialogContent>
      </Dialog>
    </div>
  );
}
