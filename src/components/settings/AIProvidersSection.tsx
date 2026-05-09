import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Plug, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConnectOpenAIDialog } from "./ConnectOpenAIDialog";

const MODEL_OPTIONS = [
  { value: "gpt-5", label: "GPT-5 (best quality)" },
  { value: "gpt-5-mini", label: "GPT-5 Mini (balanced)" },
  { value: "gpt-5-nano", label: "GPT-5 Nano (fastest)" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

type Provider = {
  key_last4: string;
  selected_model: string;
  is_default: boolean;
  verified_at: string | null;
};

export function AIProvidersSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("user_ai_providers")
      .select("key_last4, selected_model, is_default, verified_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setProvider(data as Provider | null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const callPrefs = async (updates: Partial<Pick<Provider, "selected_model" | "is_default">>) => {
    setUpdating(true);
    navigator.vibrate?.(10);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-ai-preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setProvider((p) => p ? { ...p, ...updates } as Provider : p);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your ChatGPT? StudyTime will go back to using NEXUS.")) return;
    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/disconnect-openai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Disconnect failed");
      setProvider(null);
      toast({ title: "Disconnected", description: "Back to NEXUS default." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!provider) {
    return (
      <>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Connect your ChatGPT</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Use your own OpenAI account as an option. NEXUS stays your default.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            size="sm"
            className="w-full gap-2"
            variant="outline"
          >
            <Plug className="h-4 w-4" /> Connect ChatGPT
          </Button>
        </div>
        <ConnectOpenAIDialog open={dialogOpen} onOpenChange={setDialogOpen} onConnected={() => { setDialogOpen(false); load(); }} />
      </>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">ChatGPT Connected</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">sk-…{provider.key_last4}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Model</p>
        <Select
          value={provider.selected_model}
          onValueChange={(v) => callPrefs({ selected_model: v })}
          disabled={updating}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="text-sm text-foreground">Use as my default AI</p>
          <p className="text-[11px] text-muted-foreground">Replaces NEXUS for chats</p>
        </div>
        <Switch
          checked={provider.is_default}
          onCheckedChange={(v) => callPrefs({ is_default: v })}
          disabled={updating}
        />
      </div>

      <Button
        onClick={handleDisconnect}
        size="sm"
        variant="ghost"
        className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        disabled={updating}
      >
        <Trash2 className="h-4 w-4" /> Disconnect
      </Button>
    </div>
  );
}