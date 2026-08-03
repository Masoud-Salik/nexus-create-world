import { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DuplicateDocumentError,
  UploadProgress,
  uploadDocument,
  validateFile,
} from "@/core/ingestion/uploadDocument";

const PHASE_LABEL: Record<UploadProgress["phase"], string> = {
  hashing: "Fingerprinting",
  extracting: "Reading pages",
  uploading: "Uploading",
  queued: "Queued",
};

interface Props {
  userId: string | null;
  onUploaded: () => void;
}

export function UploadDropzone({ userId, onUploaded }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      if (!userId) {
        toast({ title: "Sign in to add study material", variant: "destructive" });
        return;
      }
      for (const file of Array.from(files)) {
        const invalid = validateFile(file);
        if (invalid) {
          toast({ title: file.name, description: invalid, variant: "destructive" });
          continue;
        }
        try {
          await uploadDocument(file, userId, setProgress);
          toast({ title: `${file.name} queued`, description: "We'll process it in the background." });
          onUploaded();
        } catch (err) {
          toast({
            title: file.name,
            description:
              err instanceof DuplicateDocumentError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "Upload failed.",
            variant: "destructive",
          });
        } finally {
          setProgress(null);
        }
      }
      if (inputRef.current) inputRef.current.value = "";
    },
    [userId, toast, onUploaded],
  );

  const busy = progress !== null;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => !busy && inputRef.current?.click()}
      className={cn(
        "rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-colors",
        "bg-card/60 backdrop-blur-sm",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        busy && "pointer-events-none opacity-80",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {busy ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium">
            {PHASE_LABEL[progress.phase]}
            {progress.total > 1 ? ` ${progress.done}/${progress.total}` : "…"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          <p className="text-sm font-medium">Drop a PDF, image or note</p>
          <p className="text-xs text-muted-foreground">Up to 25 MB · 300 pages · text is read on your device</p>
        </div>
      )}
    </div>
  );
}