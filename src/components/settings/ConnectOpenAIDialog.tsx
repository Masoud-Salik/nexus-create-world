import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function ConnectOpenAIDialog({ open, onOpenChange, onConnected }: Props) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith("sk-") || trimmed.length < 20) {
      toast({ title: "Invalid key", description: "OpenAI keys start with 'sk-'.", variant: "destructive" });
      return;
    }
    setLoading(true);
    navigator.vibrate?.(10);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connect-openai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not connect");
      toast({ title: "ChatGPT connected ✨", description: `Verified key sk-…${json.last4}` });
      setApiKey("");
      onConnected();
    } catch (e: any) {
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect your ChatGPT</DialogTitle>
          <DialogDescription>
            Paste your OpenAI API key. We'll verify and store it encrypted. Your key is never shared.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="openai-key" className="text-xs">OpenAI API Key</Label>
            <Input
              id="openai-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
            />
          </div>

          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
          >
            Get your key at platform.openai.com <ExternalLink className="h-3 w-3" />
          </a>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Stored encrypted (AES-GCM). Only used to power your chats. NEXUS stays your default
              unless you switch it on.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleConnect} disabled={loading || !apiKey.trim()} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify & Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}