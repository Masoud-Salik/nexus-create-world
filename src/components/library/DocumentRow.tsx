import { FileText, Image as ImageIcon, Loader2, RotateCcw, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export interface LibraryDoc {
  id: string;
  title: string;
  mime: string;
  bytes: number;
  page_count: number;
  chunk_count: number;
  status: string;
  error: string | null;
  created_at: string;
}

const LABEL: Record<string, string> = {
  queued: "Queued",
  extracting: "Reading",
  needs_ocr: "Recognising text",
  ocr: "Recognising text",
  chunking: "Organising",
  embedding: "Indexing",
  ready: "Ready",
  failed: "Failed",
};

const WORKING = ["queued", "extracting", "needs_ocr", "ocr", "chunking", "embedding"];

function humanBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  doc: LibraryDoc;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DocumentRow({ doc, onRetry, onDelete }: Props) {
  const working = WORKING.includes(doc.status);
  const Icon = doc.mime.startsWith("image/") ? ImageIcon : FileText;

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-card/60 p-3 backdrop-blur-sm">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{doc.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Badge
              variant={doc.status === "ready" ? "default" : doc.status === "failed" ? "destructive" : "secondary"}
              className="gap-1 text-[10px]"
            >
              {working && <Loader2 className="h-3 w-3 animate-spin" />}
              {doc.status === "ready" && <CheckCircle2 className="h-3 w-3" />}
              {doc.status === "failed" && <AlertTriangle className="h-3 w-3" />}
              {LABEL[doc.status] ?? doc.status}
            </Badge>
            <span>{doc.page_count} pages</span>
            {doc.chunk_count > 0 && <span>· {doc.chunk_count} sections</span>}
            <span>· {humanBytes(doc.bytes)}</span>
            <span>· {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
          </div>
          {doc.error && <p className="mt-1 text-xs text-destructive">{doc.error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {(doc.status === "failed" || doc.status === "ready") && (
          <Button size="icon" variant="ghost" aria-label="Reprocess" onClick={() => onRetry(doc.id)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => onDelete(doc.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}