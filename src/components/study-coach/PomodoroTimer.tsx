import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, RotateCcw, Coffee, Bell, VolumeX, CheckCircle2, Sparkles } from "lucide-react";
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
  { label: "☕ 25m", value: 25 },
  { label: "📖 50m", value: 50 },
  { label: "🔥 90m", value: 90 },
];

const QUOTES = [
  "Deep work builds deep skills.",
  "Focus is the new superpower.",
  "Small sessions, big results.",
  "You're building momentum.",
  "Consistency beats intensity.",
];

const DEFAULT_FOCUS_TYPE = "study";
const SESSION_GOAL = 6;

export function PomodoroTimer({ onSessionComplete }: PomodoroTimerProps) {
  const [duration, setDuration] = useState(25);
  const [focusType] = useState(DEFAULT_FOCUS_TYPE);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [quoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const { state, startPomodoro, startBreak, pause, resume, stop, stopAlarm, dismissDoneCard } = useGlobalTimer();

  const isActive = state.type === "pomodoro";
  const isRunning = isActive && state.isRunning;
  const isAlarmPlaying = isActive && state.isAlarmPlaying;
  const showDoneCard = isActive && state.showDoneCard;
  const isBreak = isActive && !!state.pomodoroData?.isBreak;
  const timeLeft = isActive ? Math.max(0, state.totalSeconds - state.elapsedSeconds) : duration * 60;
  const totalSeconds = isActive ? state.totalSeconds : duration * 60;

  const scrubRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem("pomodoro_sessions");
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) setSessionsToday(data.count);
    }
  }, []);

  useEffect(() => {
    if (isActive && state.isAlarmPlaying && state.elapsedSeconds >= state.totalSeconds) {
      if (!isBreak) {
        const newCount = sessionsToday + 1;
        setSessionsToday(newCount);
        localStorage.setItem("pomodoro_sessions", JSON.stringify({ date: new Date().toDateString(), count: newCount }));
        onSessionComplete?.(state.pomodoroData?.duration || duration, state.pomodoroData?.focusType || focusType);
      }
    }
  }, [isActive, state.isAlarmPlaying]);

  const handleStartPause = () => {
    if (!isActive) startPomodoro(duration * 60, focusType);
    else if (isRunning) pause();
    else if (!state.isAlarmPlaying) resume();
  };

  const handleStopAlarm = () => {
    stopAlarm();
    if (!isBreak) startBreak(5 * 60);
    else stop();
  };

  const handleDismissDone = () => {
    if (!isBreak) {
      dismissDoneCard();
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

  const handleReset = () => stop();

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

  // SVG ring — thicker stroke with gradient
  const RING_SIZE = 280;
  const STROKE_WIDTH = 14;
  const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * RADIUS;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

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

  const onPointerUp = useCallback(() => { isDragging.current = false; }, []);

  const scrubRatio = (duration - MIN_DURATION) / (MAX_DURATION - MIN_DURATION);
  const isPulsing = isRunning && timeLeft <= 10 && timeLeft > 0;
  const showControls = !isActive || (!isRunning && !isAlarmPlaying && !showDoneCard && !isBreak);
  const showGlow = progress >= 70;

  // Session history dots
  const sessionDots = Array.from({ length: SESSION_GOAL }, (_, i) => i < sessionsToday);

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center justify-center flex-1 w-full select-none">

        {/* Main Timer Ring */}
        <div className="relative flex items-center justify-center mb-4" style={{ width: RING_SIZE, height: RING_SIZE }}>
          {/* Gradient definition */}
          <svg width={0} height={0}>
            <defs>
              <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(170 70% 40%)" />
              </linearGradient>
              <linearGradient id="ring-break" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--info))" />
                <stop offset="100%" stopColor="hsl(199 89% 58%)" />
              </linearGradient>
            </defs>
          </svg>
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            className="transform -rotate-90"
            style={{ filter: showGlow ? `drop-shadow(0 0 24px hsl(var(--primary) / 0.45))` : undefined }}
          >
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              fill="none" stroke="hsl(var(--muted))" strokeWidth={STROKE_WIDTH} opacity={0.35}
            />
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              fill="none"
              stroke={isBreak ? "url(#ring-break)" : "url(#ring-gradient)"}
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

            {showDoneCard ? (
              <div className="mt-2" /> /* placeholder - Done card rendered below */
            ) : isAlarmPlaying ? (
              <button onClick={handleStopAlarm}
                className="mt-2 h-16 w-16 rounded-full flex items-center justify-center shadow-xl transition-all tap-effect active:scale-95 bg-destructive text-destructive-foreground animate-pulse"
                aria-label="Stop alarm">
                <VolumeX className="h-7 w-7" />
              </button>
            ) : (
              <button onClick={handleStartPause}
                aria-label={isRunning ? "Pause timer" : "Start timer"}
                className={cn(
                  "mt-2 rounded-full flex items-center justify-center shadow-xl transition-all tap-effect active:scale-95",
                  isRunning ? "h-14 w-14" : "h-16 w-16",
                  isBreak ? "bg-info text-info-foreground" : "bg-primary text-primary-foreground",
                  !isRunning && "ring-4 ring-primary/20"
                )}>
                {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-7 w-7 ml-0.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Motivational quote during active session */}
        {isRunning && (
          <p className="text-xs text-muted-foreground italic mb-3 animate-fade-in max-w-[240px] text-center">
            "{QUOTES[quoteIndex]}"
          </p>
        )}

        {/* Scrub bar + Preset pills — only when idle */}
        {showControls && (
          <div className="w-full max-w-[300px] mb-4 animate-fade-in px-2">
            <div className="flex justify-center gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handleDurationChange(p.value)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold transition-all tap-effect border",
                    duration === p.value
                      ? "bg-primary text-primary-foreground shadow-md border-primary"
                      : "bg-card text-muted-foreground hover:bg-muted/80 border-border/60"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div ref={scrubRef} className="relative h-10 flex items-center cursor-pointer touch-none"
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-75" style={{ width: `${scrubRatio * 100}%` }} />
                </div>
              </div>
              <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
                {[15, 25, 45, 60, 75, 90].map((m) => {
                  const pos = ((m - MIN_DURATION) / (MAX_DURATION - MIN_DURATION)) * 100;
                  return <div key={m} className="absolute w-px h-3.5 bg-muted-foreground/40" style={{ left: `${pos}%` }} />;
                })}
              </div>
              <div className="absolute w-7 h-7 rounded-full bg-primary shadow-lg border-2 border-background transition-[left] duration-75 -translate-x-1/2"
                style={{ left: `${scrubRatio * 100}%` }} />
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
              <button onClick={handleReset}
                className="h-10 w-10 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:bg-muted/80 transition-all tap-effect mb-4">
                <RotateCcw className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Reset Timer</TooltipContent>
          </Tooltip>
        )}

        {/* Session history dots */}
        <div className="flex items-center gap-1.5 mb-2">
          {sessionDots.map((done, i) => (
            <div key={i} className={cn(
              "w-3 h-3 rounded-full transition-all",
              done ? "bg-primary shadow-sm shadow-primary/30" : "bg-muted border border-border/60"
            )} />
          ))}
        </div>

        <Badge variant="secondary" className="gap-1.5 text-xs">
          <span className="font-bold">{sessionsToday}</span>
          <span className="text-muted-foreground">/ {SESSION_GOAL} sessions</span>
        </Badge>
      </div>
    </TooltipProvider>
  );
}
