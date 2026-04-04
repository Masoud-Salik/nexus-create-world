import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, RotateCcw, Coffee, BookOpen, Palette, Briefcase, Bell, VolumeX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useGlobalTimer } from "@/contexts/GlobalTimerContext";
import { cn } from "@/lib/utils";

interface PomodoroTimerProps {
  onSessionComplete?: (minutes: number, focusType: string) => void;
}

const MIN_DURATION = 5;
const MAX_DURATION = 90;
const SNAP_STEP = 5;

const PRESETS = [
  { label: "25m", value: 25 },
  { label: "50m", value: 50 },
  { label: "90m", value: 90 },
];

const FOCUS_TYPES = [
  { id: "study", label: "📚", icon: BookOpen, primary: true },
  { id: "creative", label: "🛠", icon: Palette, primary: false },
  { id: "work", label: "💼", icon: Briefcase, primary: false },
];

export function PomodoroTimer({ onSessionComplete }: PomodoroTimerProps) {
  const [duration, setDuration] = useState(25);
  const [focusType, setFocusType] = useState("study");
  const [sessionsToday, setSessionsToday] = useState(0);
  const { state, startPomodoro, startBreak, pause, resume, stop, stopAlarm } = useGlobalTimer();

  // Derive timer state from global context
  const isActive = state.type === "pomodoro";
  const isRunning = isActive && state.isRunning;
  const isAlarmPlaying = isActive && state.isAlarmPlaying;
  const isBreak = isActive && !!state.pomodoroData?.isBreak;
  const timeLeft = isActive ? Math.max(0, state.totalSeconds - state.elapsedSeconds) : duration * 60;
  const totalSeconds = isActive ? state.totalSeconds : duration * 60;

  // Drag-to-set-time state
  const scrubRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Load sessions from localStorage
  useEffect(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem("pomodoro_sessions");
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        setSessionsToday(data.count);
      }
    }
  }, []);

  // Handle timer completion
  useEffect(() => {
    if (isActive && state.isAlarmPlaying && state.elapsedSeconds >= state.totalSeconds) {
      if (!isBreak) {
        const newCount = sessionsToday + 1;
        setSessionsToday(newCount);
        localStorage.setItem("pomodoro_sessions", JSON.stringify({
          date: new Date().toDateString(),
          count: newCount,
        }));
        onSessionComplete?.(state.pomodoroData?.duration || duration, state.pomodoroData?.focusType || focusType);
      }
    }
  }, [isActive, state.isAlarmPlaying]);

  const handleStartPause = () => {
    if (!isActive) {
      // Start fresh
      startPomodoro(duration * 60, focusType);
    } else if (isRunning) {
      pause();
    } else if (!state.isAlarmPlaying) {
      resume();
    }
  };

  const handleStopAlarm = () => {
    stopAlarm();
    // After alarm, transition to break or back to work
    if (!isBreak) {
      startBreak(5 * 60);
    } else {
      stop();
    }
  };

  const handleDurationChange = useCallback((mins: number) => {
    const snapped = Math.round(mins / SNAP_STEP) * SNAP_STEP;
    const clamped = Math.max(MIN_DURATION, Math.min(MAX_DURATION, snapped));
    setDuration(clamped);
    if (isActive) stop();
  }, [isActive, stop]);

  const handleReset = () => {
    stop();
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const finishTime = useMemo(() => {
    const finish = new Date(Date.now() + timeLeft * 1000);
    return finish.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [timeLeft]);

  const progress = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;

  // SVG ring dimensions
  const RING_SIZE = 280;
  const STROKE_WIDTH = 10;
  const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * RADIUS;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Scrub bar handler
  const handleScrub = useCallback((clientX: number) => {
    if (!scrubRef.current || isRunning || isBreak) return;
    const rect = scrubRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const mins = MIN_DURATION + ratio * (MAX_DURATION - MIN_DURATION);
    handleDurationChange(mins);
  }, [isRunning, isBreak, handleDurationChange]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (isRunning || isBreak) return;
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleScrub(e.clientX);
  }, [isRunning, isBreak, handleScrub]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    handleScrub(e.clientX);
  }, [handleScrub]);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const scrubRatio = (duration - MIN_DURATION) / (MAX_DURATION - MIN_DURATION);
  const isPulsing = isRunning && timeLeft <= 10 && timeLeft > 0;
  const showControls = !isActive || (!isRunning && !isAlarmPlaying && !isBreak);

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center justify-center flex-1 w-full select-none">
        {/* Focus Type Selector */}
        {showControls && (
          <div className="flex items-center gap-2 mb-5 animate-fade-in">
            {FOCUS_TYPES.map((type) => {
              const isActiveType = focusType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setFocusType(type.id)}
                  className={`
                    flex items-center gap-1.5 px-3.5 h-9 rounded-full text-xs font-semibold transition-all tap-effect
                    ${isActiveType && type.primary
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                      : isActiveType
                      ? "bg-accent text-accent-foreground shadow-md"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }
                  `}
                >
                  <type.icon className="h-3.5 w-3.5" />
                  {type.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Main Timer Ring */}
        <div className="relative flex items-center justify-center mb-4" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            className="transform -rotate-90"
            style={{ filter: progress >= 70 ? `drop-shadow(0 0 18px hsl(var(--primary) / 0.5))` : undefined }}
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={STROKE_WIDTH}
              opacity={0.5}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={isBreak ? "hsl(var(--info))" : "hsl(var(--primary))"}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span
              className={cn(
                "font-mono font-bold tabular-nums tracking-tight text-foreground transition-all",
                isPulsing && "animate-pulse text-destructive scale-105"
              )}
              style={{ fontSize: "2.75rem", lineHeight: 1 }}
            >
              {formatTime(timeLeft)}
            </span>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Bell className="h-3 w-3" />
              <span className="text-xs font-medium">{finishTime}</span>
            </div>

            {isAlarmPlaying ? (
              <button
                onClick={handleStopAlarm}
                className="mt-2 h-16 w-16 rounded-full flex items-center justify-center shadow-xl transition-all tap-effect active:scale-95 bg-destructive text-destructive-foreground animate-pulse"
                aria-label="Stop Alarm"
              >
                <VolumeX className="h-7 w-7" />
              </button>
            ) : (
              <button
                onClick={handleStartPause}
                className={cn(
                  "mt-2 rounded-full flex items-center justify-center shadow-xl transition-all tap-effect active:scale-95",
                  isRunning ? "h-14 w-14" : "h-16 w-16",
                  isBreak
                    ? "bg-info text-info-foreground"
                    : "bg-primary text-primary-foreground",
                  !isRunning && "ring-4 ring-primary/20"
                )}
                aria-label={isRunning ? "Pause" : "Start"}
              >
                {isRunning ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-7 w-7 ml-0.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Scrub bar + Presets — only when idle */}
        {showControls && (
          <div className="w-full max-w-[300px] mb-4 animate-fade-in px-2">
            <div className="flex justify-center gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handleDurationChange(p.value)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all tap-effect",
                    duration === p.value
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div
              ref={scrubRef}
              className="relative h-10 flex items-center cursor-pointer touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-75"
                    style={{ width: `${scrubRatio * 100}%` }}
                  />
                </div>
              </div>

              <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
                {[15, 25, 45, 60, 75, 90].map((m) => {
                  const pos = ((m - MIN_DURATION) / (MAX_DURATION - MIN_DURATION)) * 100;
                  return (
                    <div
                      key={m}
                      className="absolute w-px h-3.5 bg-muted-foreground/40"
                      style={{ left: `${pos}%` }}
                    />
                  );
                })}
              </div>

              <div
                className="absolute w-7 h-7 rounded-full bg-primary shadow-lg border-2 border-background transition-[left] duration-75 -translate-x-1/2"
                style={{ left: `${scrubRatio * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 px-0.5">
              <span>{MIN_DURATION}m</span>
              <span className="font-extrabold text-primary text-base -mt-1">{duration}m</span>
              <span>1h30</span>
            </div>
          </div>
        )}

        {/* Break label */}
        {isBreak && (
          <div className="flex items-center gap-2 mb-4 animate-fade-in">
            <Coffee className="h-5 w-5 text-info" />
            <span className="text-sm font-semibold text-info">Break Time — Relax!</span>
          </div>
        )}

        {/* Reset button */}
        {isActive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleReset}
                className="h-10 w-10 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:bg-muted/80 transition-all tap-effect mb-4"
                aria-label="Reset Timer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Reset Timer</TooltipContent>
          </Tooltip>
        )}

        {/* Sessions Counter */}
        <Badge variant="secondary" className="gap-1.5 text-xs">
          <span className="font-bold">{sessionsToday}</span>
          <span className="text-muted-foreground">sessions today</span>
        </Badge>
      </div>
    </TooltipProvider>
  );
}
