import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Volume2, Play, Square } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  getRingtones,
  getSelectedRingtone,
  setSelectedRingtone,
  useTimerSound,
} from "@/hooks/useTimerSound";

export function RingtoneSelector() {
  const ringtones = getRingtones();
  const [selected, setSelected] = useState(getSelectedRingtone);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { previewRingtone, stopPreview } = useTimerSound();

  const handleSelect = (id: string) => {
    setSelected(id);
    setSelectedRingtone(id);
  };

  const handlePreview = (id: string) => {
    if (playingId === id) {
      stopPreview();
      setPlayingId(null);
    } else {
      previewRingtone(id);
      setPlayingId(id);
      // Auto-stop after 5 seconds
      setTimeout(() => setPlayingId(null), 5000);
    }
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Volume2 className="h-4 w-4" />
          Timer Ringtone
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <RadioGroup value={selected} onValueChange={handleSelect} className="space-y-2">
          {ringtones.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={r.id} id={`ringtone-${r.id}`} />
                <Label htmlFor={`ringtone-${r.id}`} className="text-sm font-medium cursor-pointer">
                  {r.label}
                </Label>
              </div>
              <button
                onClick={() => handlePreview(r.id)}
                className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label={playingId === r.id ? "Stop preview" : "Preview ringtone"}
              >
                {playingId === r.id ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
