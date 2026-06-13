import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, Download, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type FeedbackRow = {
  id: string;
  message_id: string | null;
  conversation_id: string | null;
  rating: string;
  note: string | null;
  created_at: string;
  message_content?: string;
  user_input?: string;
};

export default function FeedbackTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [stats, setStats] = useState({ up: 0, down: 0, examples: 0 });
  const [editing, setEditing] = useState<string | null>(null);
  const [ideal, setIdeal] = useState("");

  const load = async () => {
    const { data: fb } = await supabase
      .from("ai_message_feedback")
      .select("id, message_id, conversation_id, rating, note, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (fb || []) as FeedbackRow[];
    // Enrich with message content for context
    const ids = list.map((r) => r.message_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: msgs } = await supabase
        .from("messages").select("id, content, conversation_id").in("id", ids);
      const convIds = Array.from(new Set((msgs || []).map((m) => m.conversation_id)));
      const { data: priorMsgs } = await supabase
        .from("messages").select("conversation_id, role, content, created_at")
        .in("conversation_id", convIds).order("created_at");
      const msgMap = new Map((msgs || []).map((m) => [m.id, m]));
      for (const r of list) {
        const m = msgMap.get(r.message_id || "");
        r.message_content = m?.content;
        if (m) {
          // Find immediately preceding user message
          const all = (priorMsgs || []).filter((p) => p.conversation_id === m.conversation_id);
          const idx = all.findIndex((p) => p.content === m.content);
          for (let i = idx - 1; i >= 0; i--) {
            if (all[i].role === "user") { r.user_input = all[i].content; break; }
          }
        }
      }
    }
    setRows(list);
    const { count: exCount } = await supabase
      .from("ai_training_examples").select("id", { count: "exact", head: true });
    setStats({
      up: list.filter((r) => r.rating === "up").length,
      down: list.filter((r) => r.rating === "down").length,
      examples: exCount || 0,
    });
  };

  useEffect(() => { load(); }, []);

  const saveExample = async (r: FeedbackRow) => {
    if (!ideal.trim() || !r.user_input) {
      toast({ title: "Need both the user question and an ideal answer", variant: "destructive" });
      return;
    }
    const { data } = await supabase.functions.invoke("ai-training", {
      body: {
        action: "save_example",
        source_message_id: r.message_id,
        user_input: r.user_input,
        ideal_response: ideal,
        tags: [r.rating === "down" ? "correction" : "exemplar"],
      },
    });
    if (data?.success) {
      toast({ title: "Saved to gold dataset ✨" });
      setEditing(null); setIdeal("");
      load();
    }
  };

  const exportDataset = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-training`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export_dataset" }),
      },
    );
    const text = await res.text();
    const blob = new Blob([text], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "training_examples.jsonl"; a.click();
    URL.revokeObjectURL(url);
  };

  const ratio = stats.up + stats.down > 0
    ? Math.round((stats.up / (stats.up + stats.down)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">👍 Up</div>
          <div className="text-2xl font-bold">{stats.up}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">👎 Down</div>
          <div className="text-2xl font-bold">{stats.down}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Approval</div>
          <div className="text-2xl font-bold">{ratio}%</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Gold examples</div>
          <div className="text-2xl font-bold">{stats.examples}</div>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={exportDataset}>
          <Download className="h-4 w-4" /> Export JSONL
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent feedback</CardTitle></CardHeader>
        <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {r.rating === "up"
                    ? <ThumbsUp className="h-4 w-4 text-primary" />
                    : <ThumbsDown className="h-4 w-4 text-destructive" />}
                  <Badge variant="outline" className="text-[10px]">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </Badge>
                </div>
                {r.user_input && r.message_content && (
                  <Button size="sm" variant="ghost"
                    onClick={() => { setEditing(r.id); setIdeal(r.message_content || ""); }}>
                    <Sparkles className="h-3 w-3" /> Curate
                  </Button>
                )}
              </div>
              {r.user_input && (
                <div className="text-xs">
                  <span className="font-medium text-muted-foreground">User:</span> {r.user_input.slice(0, 240)}
                </div>
              )}
              {r.message_content && (
                <div className="text-xs">
                  <span className="font-medium text-muted-foreground">AI:</span> {r.message_content.slice(0, 320)}
                </div>
              )}
              {r.note && <div className="text-xs italic">"{r.note}"</div>}
              {editing === r.id && (
                <div className="space-y-2 pt-2 border-t">
                  <Textarea value={ideal} onChange={(e) => setIdeal(e.target.value)}
                    placeholder="Write the ideal answer…" className="text-xs min-h-[120px]" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveExample(r)}>Save as gold example</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!rows.length && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No feedback yet — users' 👍 / 👎 on chat replies will show up here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}