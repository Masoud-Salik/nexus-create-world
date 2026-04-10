import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { useTimerSound } from "@/hooks/useTimerSound";
import { ActiveTask, CompletionStatus } from "@/components/study-coach/StudyTaskTimer";

export type TimerType = "pomodoro" | "task";

interface TimerState {
  type: TimerType | null;
  isRunning: boolean;
  elapsedSeconds: number;
  totalSeconds: number;
  isAlarmPlaying: boolean;
  showDoneCard: boolean;
  // Task-specific
  taskData: ActiveTask | null;
  // Pomodoro-specific
  pomodoroData: {
    duration: number;
    focusType: string;
    isBreak: boolean;
  } | null;
}

interface GlobalTimerContextValue {
  state: TimerState;
  startPomodoro: (totalSeconds: number, focusType: string) => void;
  startTask: (task: ActiveTask) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  stopAlarm: () => void;
  startBreak: (breakSeconds: number) => void;
  dismissDoneCard: () => void;
}

const initialState: TimerState = {
  type: null,
  isRunning: false,
  elapsedSeconds: 0,
  totalSeconds: 0,
  isAlarmPlaying: false,
  showDoneCard: false,
  taskData: null,
  pomodoroData: null,
};

const GlobalTimerContext = createContext<GlobalTimerContextValue | null>(null);

export function useGlobalTimer() {
  const ctx = useContext(GlobalTimerContext);
  if (!ctx) throw new Error("useGlobalTimer must be used within GlobalTimerProvider");
  return ctx;
}

export function GlobalTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(initialState);
  const workerRef = useRef<Worker | null>(null);
  const startTimestampRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const { playRingtone, stopPreview } = useTimerSound();

  useEffect(() => {
    workerRef.current = new Worker("/timer-worker.js");

    workerRef.current.onmessage = (event) => {
      const { type: msgType, timeLeft } = event.data;

      if (msgType === "tick") {
        setState((prev) => {
          if (!prev.isRunning && !prev.isAlarmPlaying) return prev;
          const elapsed = prev.totalSeconds - timeLeft;
          return { ...prev, elapsedSeconds: Math.max(0, Math.min(elapsed, prev.totalSeconds)) };
        });
      } else if (msgType === "finished") {
        setState((prev) => ({
          ...prev,
          elapsedSeconds: prev.totalSeconds,
          isRunning: false,
          isAlarmPlaying: true,
        }));
        // Play ringtone with fade, 3x replay, then show Done card
        playRingtone(() => {
          setState((prev) => ({
            ...prev,
            isAlarmPlaying: false,
            showDoneCard: true,
          }));
        });
      }
    };

    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  useEffect(() => {
    if (!state.isRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const wallElapsed = Math.floor((now - startTimestampRef.current) / 1000);
      const totalElapsed = pausedElapsedRef.current + wallElapsed;

      setState((prev) => {
        if (!prev.isRunning) return prev;
        const clamped = Math.min(totalElapsed, prev.totalSeconds);
        if (clamped === prev.elapsedSeconds) return prev;
        return { ...prev, elapsedSeconds: clamped };
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state.isRunning]);

  const startWorker = useCallback((seconds: number) => {
    startTimestampRef.current = Date.now();
    pausedElapsedRef.current = 0;
    if (workerRef.current) {
      workerRef.current.postMessage({ command: "start", duration: seconds });
    }
  }, []);

  const resumeWorker = useCallback((remainingSeconds: number) => {
    startTimestampRef.current = Date.now();
    if (workerRef.current) {
      workerRef.current.postMessage({ command: "resume", duration: remainingSeconds });
    }
  }, []);

  const stopWorker = useCallback(() => {
    if (workerRef.current) workerRef.current.postMessage({ command: "stop" });
  }, []);

  const pauseWorker = useCallback(() => {
    if (workerRef.current) workerRef.current.postMessage({ command: "pause" });
  }, []);

  const startPomodoro = useCallback((totalSeconds: number, focusType: string) => {
    stopWorker();
    setState({
      type: "pomodoro",
      isRunning: true,
      elapsedSeconds: 0,
      totalSeconds,
      isAlarmPlaying: false,
      showDoneCard: false,
      taskData: null,
      pomodoroData: { duration: totalSeconds / 60, focusType, isBreak: false },
    });
    startWorker(totalSeconds);
  }, [startWorker, stopWorker]);

  const startBreak = useCallback((breakSeconds: number) => {
    stopWorker();
    setState((prev) => ({
      ...prev,
      isRunning: true,
      elapsedSeconds: 0,
      totalSeconds: breakSeconds,
      isAlarmPlaying: false,
      showDoneCard: false,
      pomodoroData: prev.pomodoroData ? { ...prev.pomodoroData, isBreak: true } : null,
    }));
    startWorker(breakSeconds);
  }, [startWorker, stopWorker]);

  const startTask = useCallback((task: ActiveTask) => {
    stopWorker();
    const totalSeconds = task.duration_minutes * 60;
    setState({
      type: "task",
      isRunning: true,
      elapsedSeconds: 0,
      totalSeconds,
      isAlarmPlaying: false,
      showDoneCard: false,
      taskData: task,
      pomodoroData: null,
    });
    startWorker(totalSeconds);
  }, [startWorker, stopWorker]);

  const pause = useCallback(() => {
    pausedElapsedRef.current += Math.floor((Date.now() - startTimestampRef.current) / 1000);
    pauseWorker();
    setState((prev) => ({ ...prev, isRunning: false }));
  }, [pauseWorker]);

  const resume = useCallback(() => {
    setState((prev) => {
      if (prev.elapsedSeconds >= prev.totalSeconds) return prev;
      const remaining = prev.totalSeconds - prev.elapsedSeconds;
      resumeWorker(remaining);
      return { ...prev, isRunning: true };
    });
  }, [resumeWorker]);

  const stop = useCallback(() => {
    stopWorker();
    stopPreview();
    setState(initialState);
  }, [stopWorker, stopPreview]);

  const stopAlarm = useCallback(() => {
    stopPreview();
    setState((prev) => ({ ...prev, isAlarmPlaying: false }));
  }, [stopPreview]);

  const dismissDoneCard = useCallback(() => {
    setState((prev) => {
      // If it was a focus session (not break), transition to break
      if (prev.pomodoroData && !prev.pomodoroData.isBreak) {
        return { ...prev, showDoneCard: false };
      }
      // Otherwise reset
      return initialState;
    });
  }, []);

  return (
    <GlobalTimerContext.Provider
      value={{ state, startPomodoro, startTask, pause, resume, stop, stopAlarm, startBreak, dismissDoneCard }}
    >
      {children}
    </GlobalTimerContext.Provider>
  );
}
