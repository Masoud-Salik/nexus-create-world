import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Music, Play, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalMusic } from "@/contexts/GlobalMusicContext";

export function BackgroundMusicPlayer({ compact = true }: { compact?: boolean }) {
  const { playing, volume, toggle, setVolume } = useGlobalMusic();

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm" 
        onClick={toggle}
        className={cn(
          "gap-1 transition-colors h-7 px-2 text-xs",
          playing && "border-primary/40 bg-primary/10 text-primary"
        )}
      >
        <Music className="h-3.5 w-3.5" />
        {playing ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
      <Button
        variant={playing ? "default" : "outline"}
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={toggle}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">Study Music</p>
        <p className="text-[10px] text-muted-foreground">Persian Ambient • 528 Hz</p>
      </div>
      <div className="flex items-center gap-2 w-24">
        <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
        <Slider
          value={[volume * 100]}
          onValueChange={([v]) => setVolume(v / 100)}
          max={100}
          step={5}
          className="w-full"
        />
      </div>
    </div>
  );
}
