/**
 * E2 / M2.3 — operator view of the durable job queue.
 *
 * Reads `GET /admin-queue` (admin-only, audited). Shows depth by kind and status,
 * the age of the oldest pending job — the number the deploy runbook watches — and
 * the dead-letter list.
 */
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/core/api/client";
import { ApiError } from "@/core/api/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RefreshCw, Inbox } from "lucide-react";

interface DeadJob {
  id: string;
  kind: string;
  key: string | null;
  attempts: number;
  last_error: string | null;
  updated_at: string;
}

interface QueueSnapshot {
  by_kind: Record<string, Record<string, number>>;
  oldest_pending_age_ms: number;
  dead_letter: DeadJob[];
}

const STATUSES = ["pending", "running", "done", "failed", "dead"] as const;

function formatAge(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export default function QueueTab() {
  const [data, setData] = useState<QueueSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiRequest<QueueSnapshot>("/admin-queue"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !data) return <Skeleton className="h-64 w-full" />;

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {error}
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const kinds = Object.keys(data?.by_kind ?? {}).sort();
  const backlogStale = (data?.oldest_pending_age_ms ?? 0) > 5 * 60_000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Oldest pending</span>
          <Badge variant={backlogStale ? "destructive" : "secondary"}>
            {formatAge(data?.oldest_pending_age_ms ?? 0)}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Depth by job kind</CardTitle>
        </CardHeader>
        <CardContent>
          {kinds.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-6 w-6 opacity-50" />
              The queue is empty.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Kind</th>
                    {STATUSES.map((s) => (
                      <th key={s} className="py-2 pr-4 font-medium">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kinds.map((kind) => (
                    <tr key={kind} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{kind}</td>
                      {STATUSES.map((s) => {
                        const n = data?.by_kind[kind][s] ?? 0;
                        return (
                          <td
                            key={s}
                            className={`py-2 pr-4 tabular-nums ${
                              n === 0
                                ? "text-muted-foreground/40"
                                : s === "dead"
                                  ? "font-semibold text-destructive"
                                  : ""
                            }`}
                          >
                            {n}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Dead letter
            <Badge variant="secondary">{data?.dead_letter.length ?? 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.dead_letter.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No jobs have exhausted their retries.
            </p>
          ) : (
            data?.dead_letter.map((job) => (
              <div key={job.id} className="rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{job.kind}</span>
                  <Badge variant="outline">{job.attempts} attempts</Badge>
                  <span className="text-muted-foreground">
                    {new Date(job.updated_at).toLocaleString()}
                  </span>
                </div>
                {job.key && (
                  <p className="mt-1 break-all font-mono text-muted-foreground">{job.key}</p>
                )}
                {job.last_error && (
                  <p className="mt-1 break-words text-destructive">{job.last_error}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}