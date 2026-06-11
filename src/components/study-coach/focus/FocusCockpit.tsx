import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalTimer } from "@/contexts/GlobalTimerContext";
import { useSoundscape, SOUNDSCAPES, SoundscapeId } from "@/hooks/useSoundscape";
import { useDistractionTracker } from "@/hooks/useDistractionTracker";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { AuroraBackground } from "./AuroraBackground";
import { FocusRing } from "./FocusRing";
import { PreFlight, Energy } from "./PreFlight";
import { BreathingPrimer } from "./BreathingPrimer";
import { SessionDebrief } from "./SessionDebrief";
import { FocusStatsStrip } from "./FocusStatsStrip";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface Props {
  userId: string | null;
  streak: number;
  todayMinutes: number;
  level: number;
  xpInLevel: number;
  xpForLevel: number;
  onSessionLogged?: (minutes: number, intent: string) => void;
}

const TINT_BY_SOUND: Record<SoundscapeId, "primary" | "rain" | "warm" | "night"> = {
  silence: "primary",
  brown: "warm",
  rain: "rain",
  binaural: "night",
};

export function FocusCockpit({
  userId, streak, todayMinutes, level, xpInLevel, xpForLevel, onSessionLogged,
}: Props) {
  const { state, startPomodoro, startBreak, pause, resume, stop, stopAlarm, dismissDoneCard } = useGlobalTimer();
  const sound = useSoundscape();

  const [theater, setTheater] = useState(false);
  const [primer, setPrimer] = useState<null | { config: LaunchConfig }>(null);
  const [intent, setIntent] = useState<string>("");
  const [energy, setEnergy] = useState<Energy>("mid");
  const [debriefShown, setDebriefShown] = useState(false);

  const isActive = state.type === "pomodoro";
  const isRunning = isActive && state.isRunning;
  const isAlarm = isActive && state.isAlarmPlaying;
  const isBreak = isActive && !!state.pomodoroData?.isBreak;
  const showDoneCard = isActive && state.showDoneCard;
  const elapsed = isActive ? state.elapsedSeconds : 0;
  const total = isActive ? state.totalSeconds : 0;
  const timeLeft = Math.max(0, total - elapsed);

  // Distraction tracking only during actual focus (not break, not alarm)
  const trackerActive = isRunning && !isBreak;
  const { distractions, reset: resetDistractions } = useDistractionTracker(trackerActive);

  // Duck soundscape during alarm
  useEffect(() => {
    if (isAlarm) sound.duck(0.2);
    else sound.restore();
  }, [isAlarm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show debrief after a finished focus block
  useEffect(() => {
    if (showDoneCard && !isBreak && !debriefShown) setDebriefShown(true);
  }, [showDoneCard, isBreak, debriefShown]);

  // Daily goal in minutes (configurable later)
  const dailyGoal = 240;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const finishText = useMemo(() => {
    if (!isActive) return undefined;
    const finish = new Date(Date.now() + timeLeft * 1000);
    return finish.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [isActive, timeLeft]);

  type LaunchConfig = { intent: string; energy: Energy; minutes: number; soundscape: SoundscapeId; breathing: boolean };

  const launchFromPreFlight = (config: LaunchConfig) => {
    setIntent(config.intent);
    setEnergy(config.energy);
    if (config.soundscape !== sound.active) sound.start(config.soundscape);
    if (config.breathing) {
      setPrimer({ config });
    } else {
      beginSession(config);
    }
  };

  const beginSession = (config: LaunchConfig) => {
    setPrimer(null);
    setDebriefShown(false);
    resetDistractions();
    startPomodoro(config.minutes * 60, "study");
  };

  const handlePauseResume = () => {
    if (!isActive) return;
    if (isRunning) pause();
    else if (!isAlarm) resume();
  };

  const handleReset = () => { stop(); setDebriefShown(false); };

  const handleDebriefContinue = (_rating: 1 | 2 | 3, _note: string) => {
    if (onSessionLogged) onSessionLogged(Math.round(elapsed / 60), intent);
    setDebriefShown(false);
    dismissDoneCard();
    startBreak(5 * 60);
  };

  const handleDebriefBreak = () => {
    if (onSessionLogged) onSessionLogged(Math.round(elapsed / 60), intent);
    setDebriefShown(false);
    dismissDoneCard();
    startBreak(5 * 60);
  };

  const handleDebriefEnd = () => {
    if (onSessionLogged) onSessionLogged(Math.round(elapsed / 60), intent);
    setDebriefShown(false);
    stop();
    sound.stop();
  };

  useKeyboardShortcuts({
    space: handlePauseResume,
    r: handleReset,
    f: () => setTheater((t) => !t),
    m: () => sound.setVolume(sound.volume > 0 ? 0 : 0.45),
    escape: () => setTheater(false),
  }, true);

  const tint = TINT_BY_SOUND[sound.active] || "primary";
  const progress = total > 0 ? elapsed / total : 0;
  const goalProgress = Math.min(1, todayMinutes / Math.max(1, dailyGoal));
  const pulse = isRunning && timeLeft <= 10 && timeLeft > 0;

  // Idle state — show PreFlight
  if (!isActive && !primer) {
    return (
      <div className="relative w-full flex flex-col items-center gap-4 py-4">
        <AuroraBackground running={false} tint={tint} />
        <FocusStatsStrip
          streak={streak}
          todayMinutes={todayMinutes}
          goalMinutes={dailyGoal}
          level={level}
          xpInLevel={xpInLevel}
          xpForLevel={xpForLevel}
        />
        <PreFlight
          userId={userId}
          defaultMinutes={45}
          defaultSoundscape={sound.active}
          onLaunch={launchFromPreFlight}
        />
        <p className="text-[10px] text-muted-foreground/70 italic">
          Tip: Space = pause · F = theater · M = mute
        </p>
      </div>
    );
  }

  // Breathing primer
  if (primer) {
    return (
      <div className="relative w-full flex flex-col items-center gap-2 py-6">
        <AuroraBackground running tint={tint} />
        <BreathingPrimer
          onDone={() => beginSession(primer.config)}
          onSkip={() => beginSession(primer.config)}
        />
        <p className="text-xs text-muted-foreground italic max-w-xs text-center">
          "{primer.config.intent}" · {primer.config.minutes} minutes
        </p>
      </div>
    );
  }

  // Active session
  return (
    <div className={cn(
      "relative w-full flex flex-col items-center gap-4 py-4 transition-all",
      theater && "fixed inset-0 z-50 bg-background pt-8 overflow-y-auto"
    )}>
      <AuroraBackground running={isRunning} tint={isBreak ? "rain" : tint} />

      {!theater && (
        <FocusStatsStrip
          streak={streak}
          todayMinutes={todayMinutes + Math.round(elapsed / 60)}
          goalMinutes={dailyGoal}
          level={level}
          xpInLevel={xpInLevel}
          xpForLevel={xpForLevel}
        />
      )}

      <FocusRing
        size={theater ? 380 : 300}
        progress={progress}
        goalProgress={goalProgress}
        pulse={pulse}
        intent={isBreak ? "Break" : intent}
        timeText={formatTime(timeLeft)}
        finishText={finishText}
        distractions={distractions}
        variant={isBreak ? "break" : "focus"}
      >
        {isAlarm ? (
          <button
            onClick={() => stopAlarm()}
            className="h-14 w-14 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground animate-pulse shadow-xl"
            aria-label="Stop alarm"
          >
            <VolumeX className="h-6 w-6" />
          </button>
        ) : !debriefShown ? (
          <button
            onClick={handlePauseResume}
            className={cn(
              "rounded-full flex items-center justify-center shadow-xl transition-all tap-effect active:scale-95",
              isRunning ? "h-12 w-12 bg-card border border-border text-foreground" : "h-14 w-14 bg-primary text-primary-foreground ring-4 ring-primary/20"
            )}
            aria-label={isRunning ? "Pause" : "Resume"}
          >
            {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-6 w-6 ml-0.5" />}
          </button>
        ) : null}
      </FocusRing>

      {/* Secondary controls */}
      {!debriefShown && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="h-10 w-10 rounded-full flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors tap-effect"
            aria-label="Reset"
            title="Reset (R)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Soundscape quick switch */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="h-10 px-3 rounded-full flex items-center gap-1.5 bg-card border border-border text-xs font-semibold hover:border-primary/40 transition-colors tap-effect"
                aria-label="Soundscape mixer"
              >
                <span className="text-base leading-none">
                  {SOUNDSCAPES.find((s) => s.id === sound.active)?.emoji}
                </span>
                <span className="hidden sm:inline">{SOUNDSCAPES.find((s) => s.id === sound.active)?.label}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <div className="space-y-4 pt-2">
                <div>
                  <div className="text-sm font-bold mb-2">Soundscape</div>
                  <div className="grid grid-cols-4 gap-2">
                    {SOUNDSCAPES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => sound.start(s.id)}
                        className={cn(
                          "py-3 rounded-xl border text-[11px] font-semibold transition-all tap-effect",
                          sound.active === s.id
                            ? "bg-primary/10 border-primary"
                            : "bg-card border-border text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        <div className="text-xl">{s.emoji}</div>
                        <div className="mt-0.5">{s.label}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 italic">
                    {SOUNDSCAPES.find((s) => s.id === sound.active)?.description}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold">Volume</span>
                    <span className="text-xs text-muted-foreground">{Math.round(sound.volume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <Slider
                      value={[sound.volume * 100]}
                      onValueChange={([v]) => sound.setVolume(v / 100)}
                      max={100}
                      step={5}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Binaural beats need headphones to work properly.
                  </p>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <button
            onClick={() => setTheater((t) => !t)}
            className="h-10 w-10 rounded-full flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors tap-effect"
            aria-label="Theater mode"
            title="Theater (F)"
          >
            {theater ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      )}

      {debriefShown && (
        <SessionDebrief
          elapsedSeconds={elapsed}
          plannedSeconds={total}
          distractions={distractions}
          intent={intent}
          onContinue={handleDebriefContinue}
          onBreak={handleDebriefBreak}
          onEnd={handleDebriefEnd}
        />
      )}

      {!debriefShown && isRunning && distractions === 0 && (
        <p className="text-[11px] text-muted-foreground italic max-w-[260px] text-center animate-fade-in">
          🌱 Deep work is being deposited.
        </p>
      )}
    </div>
  );
}