import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Upload, Search, FileText, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Doc = {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  status: string;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
};

export default function KnowledgeTab() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("ai_knowledge_docs")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data as Doc[]) || []);
  };

  useEffect(() => { load(); }, []);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setContent(text);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const ingest = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }
    setUploading(true);
    const { data, error } = await supabase.functions.invoke("ai-training", {
      body: {
        action: "ingest_doc",
        title,
        content,
        source_type: sourceUrl ? "url" : "text",
        source_url: sourceUrl || null,
      },
    });
    setUploading(false);
    if (error || data?.error) {
      toast({ title: "Ingest failed", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: `Indexed ${data.chunks} chunks ✨` });
      setTitle(""); setContent(""); setSourceUrl("");
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this document and all its chunks?")) return;
    const { data } = await supabase.functions.invoke("ai-training", {
      body: { action: "delete_doc", doc_id: id },
    });
    if (data?.success) {
      toast({ title: "Deleted" });
      load();
    }
  };

  const testSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const { data } = await supabase.functions.invoke("ai-training", {
      body: { action: "test_search", query, top_k: 5 },
    });
    setSearching(false);
    setResults(data?.results || []);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Add knowledge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="kt-title">Title</Label>
            <Input id="kt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course intro chapter 1" />
          </div>
          <div>
            <Label htmlFor="kt-url">Source URL (optional)</Label>
            <Input id="kt-url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label htmlFor="kt-file">Upload file (.txt, .md)</Label>
            <Input id="kt-file" type="file" accept=".txt,.md,.markdown,text/plain"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          <div>
            <Label htmlFor="kt-content">Or paste content</Label>
            <Textarea id="kt-content" value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Paste raw text…" className="min-h-[200px] font-mono text-xs" />
            <p className="text-xs text-muted-foreground mt-1">{content.length.toLocaleString()} chars</p>
          </div>
          <Button onClick={ingest} disabled={uploading} className="w-full">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Embedding…" : "Ingest & embed"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Test retrieval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask any question…" onKeyDown={(e) => e.key === "Enter" && testSearch()} />
              <Button onClick={testSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {results.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{r.doc_title}</span>
                    <Badge variant="outline">{(r.similarity * 100).toFixed(0)}%</Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-3">{r.content}</p>
                </div>
              ))}
              {!results.length && !searching && <p className="text-xs text-muted-foreground">No results yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Indexed documents ({docs.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-start gap-3 min-w-0">
                  {d.source_type === "url" ? <Globe className="h-4 w-4 mt-1 shrink-0" /> : <FileText className="h-4 w-4 mt-1 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={d.status === "ready" ? "default" : d.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                        {d.status}
                      </Badge>
                      <span>{d.chunk_count} chunks</span>
                      <span>· {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                    </div>
                    {d.error_message && <p className="text-xs text-destructive mt-1">{d.error_message}</p>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!docs.length && <p className="text-sm text-muted-foreground text-center py-8">No docs yet — add one to ground NEXUS.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}