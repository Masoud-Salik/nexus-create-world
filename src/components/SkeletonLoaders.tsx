import { Skeleton } from "@/components/ui/skeleton";

export function StudyCoachSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Stats bar */}
      <Skeleton className="h-10 w-full rounded-lg" />
      {/* Timer ring */}
      <div className="flex justify-center py-6">
        <Skeleton className="h-48 w-48 rounded-full" />
      </div>
      {/* Task cards */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Chat header */}
      <Skeleton className="h-12 w-full rounded-lg" />
      {/* Message bubbles */}
      <div className="space-y-3 pt-4">
        <div className="flex justify-end">
          <Skeleton className="h-12 w-3/5 rounded-2xl rounded-br-sm" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-20 w-4/5 rounded-2xl rounded-bl-sm" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-2/5 rounded-2xl rounded-br-sm" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-16 w-3/5 rounded-2xl rounded-bl-sm" />
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Profile card */}
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      {/* Toggle rows */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between p-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
