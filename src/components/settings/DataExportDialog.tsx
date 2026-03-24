import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, FileJson, Check } from "lucide-react";

interface DataExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const DATA_CATEGORIES = [
  { id: "profile", label: "Profile Information", table: "profiles" },
  { id: "conversations", label: "Conversations & Messages", tables: ["conversations", "messages"] },
  { id: "goals", label: "Goals & Habits", tables: ["goals", "habits", "weekly_goals"] },
  { id: "activities", label: "Daily Activities & Check-ins", tables: ["daily_activities", "daily_checkins"] },
  { id: "study", label: "Study Data", tables: ["study_subjects", "study_tasks", "study_sessions"] },
  { id: "predictions", label: "AI Predictions & Scenarios", tables: ["predictions", "future_scenarios"] },
  { id: "memory", label: "AI Memories & Insights", tables: ["ai_memory", "user_insights"] },
  { id: "personal", label: "Skills, Interests & Friends", tables: ["abilities_skills", "interests", "friends_identities"] },
  { id: "ideas", label: "Idea Vault", table: "idea_vault" },
];

export function DataExportDialog({ open, onOpenChange, userId }: DataExportDialogProps) {
  const { toast } = useToast();
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    DATA_CATEGORIES.map(c => c.id)
  );
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exported, setExported] = useState(false);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedCategories(DATA_CATEGORIES.map(c => c.id));
  const deselectAll = () => setSelectedCategories([]);

  const handleExport = async () => {
    if (selectedCategories.length === 0) {
      toast({
        title: "Select data to export",
        description: "Please select at least one category",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(0);
    setExported(false);

    try {
      const exportData: Record<string, any> = {
        exportDate: new Date().toISOString(),
        userId,
      };

      const selectedConfigs = DATA_CATEGORIES.filter(c => selectedCategories.includes(c.id));
      const totalTables = selectedConfigs.reduce((acc, c) => {
        if ('tables' in c) return acc + c.tables.length;
        return acc + 1;
      }, 0);

      let completedTables = 0;

      for (const config of selectedConfigs) {
        const tables = 'tables' in config ? config.tables : [config.table as string];
        
        for (const table of tables) {
          try {
            const idColumn = table === "profiles" ? "id" : "user_id";
            // Use dynamic query approach
            const { data, error } = await supabase
              .from(table as any)
              .select("*")
              .eq(idColumn, userId);

            if (error) {
              console.error(`Error fetching ${table}:`, error);
            } else {
              exportData[table] = data;
            }
          } catch (err) {
            console.error(`Error fetching ${table}:`, err);
          }

          completedTables++;
          setProgress(Math.round((completedTables / totalTables) * 100));
        }
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nexus-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExported(true);
      toast({
        title: "Export complete",
        description: "Your data has been downloaded successfully",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setExported(false);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Export Your Data
          </DialogTitle>
          <DialogDescription>
            Download a copy of your personal data in JSON format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm">Exporting your data...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progress}% complete</p>
            </div>
          ) : exported ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-medium">Export Complete!</p>
                <p className="text-sm text-muted-foreground">Your data has been downloaded</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Select data to export:</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>All</Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>None</Button>
                </div>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {DATA_CATEGORIES.map((category) => (
                  <div key={category.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={category.id}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                    <Label
                      htmlFor={category.id}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {category.label}
                    </Label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {exported ? "Close" : "Cancel"}
          </Button>
          {!exported && (
            <Button onClick={handleExport} disabled={loading || selectedCategories.length === 0} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Data
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
