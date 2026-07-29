import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Brain, BookOpen, MessageSquareHeart, Sparkles, ListChecks } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import KnowledgeTab from "@/components/ai-training/KnowledgeTab";
import PromptStudioTab from "@/components/ai-training/PromptStudioTab";
import FeedbackTab from "@/components/ai-training/FeedbackTab";
import QueueTab from "@/components/ai-training/QueueTab";
import { Skeleton } from "@/components/ui/skeleton";

export default function AITraining() {
  usePageMeta({ title: "AI Training Console", description: "Train, tune, and ground the NEXUS AI." });
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdmin === false) navigate("/chat", { replace: true });
  }, [isAdmin, navigate]);

  if (isAdmin === null) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AI Training Console</h1>
              <p className="text-sm text-muted-foreground">
                Ground NEXUS in your knowledge, tune its persona, curate gold answers.
              </p>
            </div>
          </div>
        </header>

        <Tabs defaultValue="knowledge" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-12">
            <TabsTrigger value="knowledge" className="gap-2"><BookOpen className="h-4 w-4" />Knowledge</TabsTrigger>
            <TabsTrigger value="prompt" className="gap-2"><Sparkles className="h-4 w-4" />Prompt Studio</TabsTrigger>
            <TabsTrigger value="feedback" className="gap-2"><MessageSquareHeart className="h-4 w-4" />Feedback</TabsTrigger>
            <TabsTrigger value="queue" className="gap-2"><ListChecks className="h-4 w-4" />Queue</TabsTrigger>
          </TabsList>
          <TabsContent value="knowledge" className="mt-6"><KnowledgeTab /></TabsContent>
          <TabsContent value="prompt" className="mt-6"><PromptStudioTab /></TabsContent>
          <TabsContent value="feedback" className="mt-6"><FeedbackTab /></TabsContent>
          <TabsContent value="queue" className="mt-6"><QueueTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}