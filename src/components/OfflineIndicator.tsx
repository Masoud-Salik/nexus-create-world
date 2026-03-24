import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, Check } from "lucide-react";
import { getPendingCount } from "@/utils/offlineQueue";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [justCameOnline, setJustCameOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setJustCameOnline(true);
      // Hide the "back online" message after 3 seconds
      setTimeout(() => setJustCameOnline(false), 3000);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setJustCameOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update pending count periodically when offline
  useEffect(() => {
    if (isOffline) {
      const interval = setInterval(() => {
        setPendingCount(getPendingCount());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOffline]);

  // Show "back online" animation
  if (justCameOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-500/90 backdrop-blur-sm py-2 px-4 flex items-center justify-center gap-2 text-white text-sm animate-slide-down">
        <Check className="h-4 w-4" />
        <span className="font-medium">Back online</span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Syncing {pendingCount} {pendingCount === 1 ? 'change' : 'changes'}...
          </span>
        )}
      </div>
    );
  }

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 backdrop-blur-sm py-2.5 px-4 flex items-center justify-center gap-2 text-warning-foreground text-sm animate-slide-down safe-area-pt">
      <WifiOff className="h-4 w-4" />
      <span className="font-medium">Offline Mode</span>
      {pendingCount > 0 ? (
        <span className="text-xs opacity-80">• {pendingCount} pending</span>
      ) : (
        <span className="text-xs opacity-80 hidden sm:inline">• Study tasks available</span>
      )}
    </div>
  );
}
