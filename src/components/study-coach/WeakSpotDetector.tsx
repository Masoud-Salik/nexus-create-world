import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export interface WeakSpot {
  topic: string;
  accuracy: number;
  suggestedMinutes: number;
}

interface WeakSpotDetectorProps {
  weakSpots: WeakSpot[];
}

export function WeakSpotDetector({ weakSpots }: WeakSpotDetectorProps) {
  if (weakSpots.length === 0) return null;

  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <h3 className="font-medium text-foreground">Areas to Review</h3>
        </div>
        
        <div className="space-y-3">
          {weakSpots.slice(0, 2).map((spot) => (
            <div key={spot.topic} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{spot.topic}</p>
                <p className="text-xs text-muted-foreground">
                  Accuracy: {spot.accuracy}%
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                +{spot.suggestedMinutes} min suggested
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
