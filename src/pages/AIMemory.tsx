import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Brain, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Memory {
  id: string;
  category: string;
  content: string;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  preference: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  habit: "bg-green-500/20 text-green-400 border-green-500/30",
  goal: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  personal_fact: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  belief: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  health: "bg-red-500/20 text-red-400 border-red-500/30",
  skill: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function AIMemory() {
  usePageMeta({ title: "AI Memory", description: "Manage what your AI coach remembers about you." });
  const navigate = useNavigate();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLearningEnabled, setAiLearningEnabled] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMemories();
    fetchSettings();
  }, []);

  const fetchMemories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("ai_memory")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMemories(data || []);
    } catch (error) {
      console.error("Error fetching memories:", error);
      toast({ title: "Error loading memories", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("ai_learning_enabled")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setAiLearningEnabled(data?.ai_learning_enabled ?? true);
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const toggleAiLearning = async (enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ ai_learning_enabled: enabled })
        .eq("id", user.id);

      if (error) throw error;
      setAiLearningEnabled(enabled);
      toast({ title: enabled ? "AI learning enabled" : "AI learning disabled" });
    } catch (error) {
      console.error("Error updating settings:", error);
      toast({ title: "Error updating setting", variant: "destructive" });
    }
  };

  const deleteMemory = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("ai_memory")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setMemories(memories.filter(m => m.id !== id));
      toast({ title: "Memory deleted" });
    } catch (error) {
      console.error("Error deleting memory:", error);
      toast({ title: "Error deleting memory", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredMemories = selectedCategory === "all"
    ? memories
    : memories.filter(m => m.category === selectedCategory);

  const categories = ["all", ...new Set(memories.map(m => m.category))];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">AI Memory</h1>
          </div>
        </div>

        {/* Settings Card */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Memory Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="ai-learning" className="font-medium">
                  Allow AI to learn from chats
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, the AI will extract and remember important information from your conversations.
                </p>
              </div>
              <Switch
                id="ai-learning"
                checked={aiLearningEnabled}
                onCheckedChange={toggleAiLearning}
              />
            </div>
          </CardContent>
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-4">
          <Label>Filter by category:</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat === "all" ? "All Categories" : cat.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto">
            {filteredMemories.length} memories
          </Badge>
        </div>

        {/* Memories List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredMemories.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {memories.length === 0
                  ? "No memories yet. Start chatting and the AI will learn about you!"
                  : "No memories in this category."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {filteredMemories.map(memory => (
                <Card key={memory.id} className="group hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={categoryColors[memory.category] || ""}
                          >
                            {memory.category.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(memory.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm">{memory.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={() => deleteMemory(memory.id)}
                        disabled={deletingId === memory.id}
                      >
                        {deletingId === memory.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
