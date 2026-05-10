import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, X, Settings as SettingsIcon, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AIProvidersSection } from "@/components/settings/AIProvidersSection";

const DISMISS_KEY = "ai_provider_banner_dismissed_v1";

type Provider = { key_last4: string; selected_model: string; is_default: boolean } | null;

export function AIProviderBanner() {
  const [provider, setProvider] = useState<Provider>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_ai_providers")
        .select("key_last4, selected_model, is_default")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setProvider(data as Provider);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!provider) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    navigator.vibrate?.(10);
  };

  const handleSwitch = async () => {
    setBusy(true);
    navigator.vibrate?.(10);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-ai-preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ is_default: true }),
      });
      if (res.ok) setProvider({ ...provider, is_default: true });
    } finally {
      setBusy(false);
    }
  };

  // Connected & active default → tiny pill
  if (provider.is_default) {
    return (
      <div className="px-4 py-1.5 flex items-center justify-center gap-1.5 bg-emerald-500/5 border-b border-emerald-500/10 animate-in fade-in slide-in-from-top-1 duration-300">
        <Sparkles className="h-3 w-3 text-emerald-500" />
        <span className="text-[11px] text-foreground/80">
          Powered by your ChatGPT · <span className="font-mono">{provider.selected_model}</span>
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-[11px] text-primary hover:underline ml-1 inline-flex items-center gap-0.5">
              <SettingsIcon className="h-2.5 w-2.5" /> Manage <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
            <AIProvidersSection />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Connected but NEXUS still default → invitation banner (dismissible)
  if (dismissed) return null;

  return (
    <div className="px-3 py-2 mx-3 mt-2 rounded-xl bg-background/70 backdrop-blur-md border border-primary/20 shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="text-[11px] text-foreground flex-1 leading-tight">
        Your ChatGPT is connected. Make it default?
      </p>
      <button
        onClick={handleSwitch}
        disabled={busy}
        className="text-[11px] font-semibold text-primary px-2 py-1 rounded-md hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        Switch
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}