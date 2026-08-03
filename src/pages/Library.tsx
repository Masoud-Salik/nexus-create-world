import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { UploadDropzone } from "@/components/library/UploadDropzone";
import { DocumentRow, LibraryDoc } from "@/components/library/DocumentRow";
import { deleteDocument, retryDocument } from "@/core/ingestion/uploadDocument";
import { Input } from "@/components/ui/input";
import { Search, Library as LibraryIcon } from "lucide-react";

const WORKING = ["queued", "extracting", "needs_ocr", "ocr", "chunking", "embedding"];

export default function Library() {
  usePageMeta({
    title: "Library",
    description:
      "Upload PDFs, notes and images. StudyTime reads them on your device and turns them into searchable study material.",
  });

  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, title, mime, bytes, page_count, chunk_count, status, error, created_at")
      .order("created_at", { ascending: false });
    setDocs((data as LibraryDoc[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, [load]);

  // Processing happens on the queue, so poll while anything is still in flight.
  const anyWorking = docs.some((d) => WORKING.includes(d.status));
  useEffect(() => {
    if (!anyWorking) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [anyWorking, load]);

  const filtered = useMemo(
    () => docs.filter((d) => d.title.toLowerCase().includes(q.trim().toLowerCase())),
    [docs, q],
  );

  const onRetry = async (id: string) => {
    try {
      await retryDocument(id);
      toast({ title: "Reprocessing" });
      load();
    } catch (e) {
      toast({ title: "Could not reprocess", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const onDelete = async (id: string) => {
    if (!userId) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      await deleteDocument(id, userId);
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
      load();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-28 pt-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <LibraryIcon className="h-5 w-5 text-primary" />
          Library
        </h1>
        <p className="text-sm text-muted-foreground">
          Your study material, read on your device and indexed for recall.
        </p>
      </header>

      <UploadDropzone userId={userId} onUploaded={load} />

      {docs.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your library" className="pl-9" />
        </div>
      )}

      <section className="space-y-2">
        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
        {!loading && !filtered.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {docs.length ? "Nothing matches that search." : "Nothing here yet — add your first document above."}
          </p>
        )}
        {filtered.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} onRetry={onRetry} onDelete={onDelete} />
        ))}
      </section>
    </div>
  );
}