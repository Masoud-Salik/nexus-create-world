import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGlobalTimer } from "@/contexts/GlobalTimerContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Play, Pause, Square, Check, AlertTriangle, VolumeX } from "lucide-react";
import { BookOpen, Calculator, Pen, Globe, FlaskConical, Music } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  book: BookOpen,
  calculator: Calculator,
  pen: Pen,
  globe: Globe,
  flask: FlaskConical,
  music: Music,
};

export interface ActiveTask {
  id: string;
  subject_name: string;
  icon_name: string;
  color: string;
  topic: string;
  duration_minutes: number;
  difficulty: "easy" | "medium" | "hard";
}

export type CompletionStatus = "completed" | "partial" | "skipped";

interface StudyTaskTimerProps {
  task: ActiveTask;
  onComplete: (taskId: string, status: CompletionStatus, actualMinutes: number) => void;
  onCancel: () => void;
}

const MINIMUM_PERCENTAGE = 0.7;
const PARTIAL_THRESHOLD = 0.3;

export function StudyTaskTimer({ task, onComplete, onCancel }: StudyTaskTimerProps) {
  const [showEarlyFinishDialog, setShowEarlyFinishDialog] = useState(false);
  const { state, startTask, pause, resume, stop, stopAlarm } = useGlobalTimer();

  const isActive = state.type === "task" && state.taskData?.id === task.id;
  const elapsedSeconds = isActive ? state.elapsedSeconds : 0;
  const isRunning = isActive && state.isRunning;
  const isAlarmPlaying = isActive && state.isAlarmPlaying;

  const plannedSeconds = task.duration_minutes * 60;
  const minimumSeconds = Math.floor(plannedSeconds * MINIMUM_PERCENTAGE);
  const partialThresholdSeconds = Math.floor(plannedSeconds * PARTIAL_THRESHOLD);

  // Start timer on mount if not already running for this task
  useEffect(() => {
    if (!isActive) {
      startTask(task);
    }
  }, [task.id]);

  const getCompletionStatus = useCallback((seconds: number): CompletionStatus => {
    const percentage = seconds / plannedSeconds;
    if (percentage >= MINIMUM_PERCENTAGE) return "completed";
    if (percentage >= PARTIAL_THRESHOLD) return "partial";
    return "skipped";
  }, [plannedSeconds]);

  const formatTime = (seconds: number) => {
    const remaining = Math.max(0, plannedSeconds - seconds);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePauseResume = () => {
    if (isRunning) {
      pause();
    } else {
      resume();
    }
  };

  const handleDone = () => {
    const status = getCompletionStatus(elapsedSeconds);
    if (status !== "completed") {
      setShowEarlyFinishDialog(true);
      if (isRunning) pause();
    } else {
      finishTask("completed");
    }
  };

  const handleCancel = () => {
    if (elapsedSeconds < partialThresholdSeconds) {
      stop();
      onCancel();
    } else {
      setShowEarlyFinishDialog(true);
      if (isRunning) pause();
    }
  };

  const finishTask = (status: CompletionStatus) => {
    const actualMinutes = Math.round(elapsedSeconds / 60);
    stop();
    onComplete(task.id, status, actualMinutes);
  };

  const handleConfirmEarlyFinish = () => {
    const status = getCompletionStatus(elapsedSeconds);
    finishTask(status);
    setShowEarlyFinishDialog(false);
  };

  const handleContinueStudying = () => {
    setShowEarlyFinishDialog(false);
    resume();
  };

  const progress = Math.min((elapsedSeconds / plannedSeconds) * 100, 100);
  const currentStatus = getCompletionStatus(elapsedSeconds);
  const IconComponent = iconMap[task.icon_name] || BookOpen;

  const getProgressColor = () => {
    if (currentStatus === "completed") return "bg-green-500";
    if (currentStatus === "partial") return "bg-yellow-500";
    return "bg-primary";
  };

  const getMotivationalMessage = () => {
    const percentage = (elapsedSeconds / plannedSeconds) * 100;
    if (percentage >= 90) return "Almost there! 🔥";
    if (percentage >= 70) return "Great progress! 💪";
    if (percentage >= 50) return "Halfway! ⚡";
    if (percentage >= 25) return "Keep going! 🚀";
    return "Let's do this! 📚";
  };

  return (
    <>
      <div className="flex flex-col h-full w-full px-4 overflow-hidden">
        {/* Top: Subject info */}
        <div className="pt-2 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg shrink-0"
              style={{ backgroundColor: `${task.color}20` }}
            >
              <IconComponent className="h-4 w-4" style={{ color: task.color }} />
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {task.subject_name}
            </Badge>
            <span className="text-xs text-muted-foreground shrink-0">
              {task.duration_minutes}m
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-snug">
            {task.topic}
          </p>
        </div>

        {/* Center: Timer */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <div className="text-6xl sm:text-7xl font-mono font-bold text-foreground tabular-nums tracking-tight">
            {formatTime(elapsedSeconds)}
          </div>
          <p className="text-sm font-medium text-primary mt-2">
            {getMotivationalMessage()}
          </p>
        </div>

        {/* Bottom: Progress + Controls */}
        <div className="pb-4 space-y-4 shrink-0">
          <div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getProgressColor()}`}
                style={{
                  width: `${progress}%`,
                  boxShadow: progress >= 70 ? '0 0 12px rgba(34, 197, 94, 0.6)' : undefined
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
              <span className="font-medium">{Math.round(progress)}%</span>
              <span>{currentStatus === "completed" ? "✓ On Track" : currentStatus === "partial" ? "Almost" : "Started"}</span>
              <span>{Math.ceil(minimumSeconds / 60)}m min</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            {isAlarmPlaying ? (
              <Button
                size="lg"
                onClick={() => { stopAlarm(); finishTask("completed"); }}
                className="h-16 w-16 p-0 rounded-full bg-destructive hover:bg-destructive/90 animate-pulse"
              >
                <VolumeX className="h-7 w-7" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCancel}
                  className="h-12 w-12 p-0 rounded-full"
                >
                  <Square className="h-5 w-5" />
                </Button>

                <Button
                  size="lg"
                  variant={isRunning ? "secondary" : "default"}
                  onClick={handlePauseResume}
                  className="h-14 w-14 p-0 rounded-full"
                >
                  {isRunning ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </Button>

                <Button
                  size="lg"
                  onClick={handleDone}
                  className="h-12 w-12 p-0 rounded-full bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showEarlyFinishDialog} onOpenChange={setShowEarlyFinishDialog}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Finish Early?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Studied <strong>{Math.round(elapsedSeconds / 60)}m</strong> of{" "}
                <strong>{task.duration_minutes}m</strong> planned.
              </p>
              <div className={`p-2 rounded-lg text-sm ${
                currentStatus === "skipped"
                  ? "bg-muted"
                  : "bg-yellow-500/10 border border-yellow-500/20"
              }`}>
                <p className="font-medium">
                  {currentStatus === "skipped"
                    ? "Will be marked as Skipped"
                    : "Will be marked as Partial"}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={handleContinueStudying} className="flex-1">
              Continue
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmEarlyFinish}
              className={`flex-1 ${currentStatus === "skipped" ? "bg-destructive hover:bg-destructive/90" : "bg-yellow-600 hover:bg-yellow-700"}`}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
