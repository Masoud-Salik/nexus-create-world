import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Plus, Save, Trash2, X, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Version = {
  id: string;
  name: string;
  system_prompt: string;
  persona: string | null;
  temperature: number;
  max_tokens: number;
  tool_aggressiveness: string;
  few_shots: Array<{ user: string; assistant: string }>;
  is_active: boolean;
  created_at: string;
};

const PERSONAS = [
  { value: "friendly_tutor", label: "Friendly tutor" },
  { value: "strict_tutor", label: "Strict tutor" },
  { value: "socratic", label: "Socratic" },
  { value: "exam_mode", label: "Exam mode" },
];

export default function PromptStudioTab() {
  const { toast } = useToast();
  const [versions, setVersions] = useState<Version[]>([]);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [persona, setPersona] = useState("friendly_tutor");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [tool, setTool] = useState("balanced");
  const [fewShots, setFewShots] = useState<Array<{ user: string; assistant: string }>>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("ai_prompt_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    const list = ((data as unknown) as Version[]) || [];
    setVersions(list);
    const active = list.find((v) => v.is_active) || list[0];
    if (active && !name) loadInto(active);
  };

  const loadInto = (v: Version) => {
    setName(v.name);
    setSystemPrompt(v.system_prompt);
    setPersona(v.persona || "friendly_tutor");
    setTemperature(Number(v.temperature));
    setMaxTokens(v.max_tokens);
    setTool(v.tool_aggressiveness);
    setFewShots(Array.isArray(v.few_shots) ? v.few_shots : []);
  };

  useEffect(() => { load(); }, []);

  const save = async (activate: boolean) => {
    if (!name.trim() || !systemPrompt.trim()) {
      toast({ title: "Name and system prompt required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("ai-training", {
      body: {
        action: "save_prompt",
        name, system_prompt: systemPrompt, persona,
        temperature, max_tokens: maxTokens, tool_aggressiveness: tool,
        few_shots: fewShots, activate,
      },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Save failed", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: activate ? "Saved & activated 🚀" : "Saved as draft" });
      load();
    }
  };

  const activate = async (id: string) => {
    const { data } = await supabase.functions.invoke("ai-training", {
      body: { action: "activate_prompt", id },
    });
    if (data?.success) { toast({ title: "Activated" }); load(); }
  };

  const tokens = Math.ceil(systemPrompt.length / 4);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Edit prompt version</CardTitle>
              <Badge variant="outline">~{tokens.toLocaleString()} tokens</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NEXUS v2 — Strict tutor" />
              </div>
              <div>
                <Label>Persona</Label>
                <Select value={persona} onValueChange={setPersona}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERSONAS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>System prompt</Label>
              <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[280px] font-mono text-xs leading-relaxed" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Temperature: {temperature.toFixed(2)}</Label>
                <Slider value={[temperature]} min={0} max={1.5} step={0.05}
                  onValueChange={([v]) => setTemperature(v)} />
              </div>
              <div>
                <Label>Max tokens: {maxTokens}</Label>
                <Slider value={[maxTokens]} min={256} max={8192} step={128}
                  onValueChange={([v]) => setMaxTokens(v)} />
              </div>
              <div>
                <Label>Tool use</Label>
                <Select value={tool} onValueChange={setTool}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Few-shot examples ({fewShots.length})</Label>
                <Button size="sm" variant="outline" onClick={() => setFewShots([...fewShots, { user: "", assistant: "" }])}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {fewShots.map((fs, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2 p-3 rounded-lg border">
                    <Textarea placeholder="Example user message" value={fs.user}
                      onChange={(e) => {
                        const next = [...fewShots]; next[i] = { ...fs, user: e.target.value }; setFewShots(next);
                      }} className="text-xs min-h-[80px]" />
                    <div className="flex gap-2">
                      <Textarea placeholder="Ideal assistant reply" value={fs.assistant}
                        onChange={(e) => {
                          const next = [...fewShots]; next[i] = { ...fs, assistant: e.target.value }; setFewShots(next);
                        }} className="text-xs min-h-[80px] flex-1" />
                      <Button size="icon" variant="ghost"
                        onClick={() => setFewShots(fewShots.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!fewShots.length && <p className="text-xs text-muted-foreground">No examples. Add 1–3 to steer style.</p>}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => save(false)} disabled={saving} variant="outline" className="flex-1">
                <Save className="h-4 w-4" /> Save as draft
              </Button>
              <Button onClick={() => save(true)} disabled={saving} className="flex-1">
                <Check className="h-4 w-4" /> Save & activate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[700px] overflow-y-auto">
          {versions.map((v) => (
            <div key={v.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${v.is_active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              onClick={() => loadInto(v)}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{v.name}</span>
                {v.is_active && <Badge className="text-[10px]">ACTIVE</Badge>}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-between mt-1">
                <span>{v.persona || "default"} · T:{Number(v.temperature).toFixed(2)}</span>
                <span>{formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}</span>
              </div>
              {!v.is_active && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs mt-1"
                  onClick={(e) => { e.stopPropagation(); activate(v.id); }}>
                  Activate
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}