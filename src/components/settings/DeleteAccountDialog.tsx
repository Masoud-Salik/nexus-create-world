import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function DeleteAccountDialog({ open, onOpenChange, userEmail }: DeleteAccountDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: "Please type DELETE to confirm",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Delete all user data from various tables
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Delete in order to respect foreign keys
      const deletions = [
        supabase.from("messages").delete().eq("user_id", user.id),
        supabase.from("conversations").delete().eq("user_id", user.id),
        supabase.from("ai_memory").delete().eq("user_id", user.id),
        supabase.from("daily_activities").delete().eq("user_id", user.id),
        supabase.from("daily_checkins").delete().eq("user_id", user.id),
        supabase.from("goals").delete().eq("user_id", user.id),
        supabase.from("habits").delete().eq("user_id", user.id),
        supabase.from("predictions").delete().eq("user_id", user.id),
        supabase.from("future_scenarios").delete().eq("user_id", user.id),
        supabase.from("study_sessions").delete().eq("user_id", user.id),
        supabase.from("study_tasks").delete().eq("user_id", user.id),
        supabase.from("study_subjects").delete().eq("user_id", user.id),
        supabase.from("abilities_skills").delete().eq("user_id", user.id),
        supabase.from("interests").delete().eq("user_id", user.id),
        supabase.from("friends_identities").delete().eq("user_id", user.id),
        supabase.from("user_documents").delete().eq("user_id", user.id),
        supabase.from("situation_photos").delete().eq("user_id", user.id),
        supabase.from("user_insights").delete().eq("user_id", user.id),
        supabase.from("weekly_goals").delete().eq("user_id", user.id),
        supabase.from("weekly_reports").delete().eq("user_id", user.id),
        supabase.from("skill_scores").delete().eq("user_id", user.id),
        supabase.from("daily_coach_messages").delete().eq("user_id", user.id),
        supabase.from("idea_vault").delete().eq("user_id", user.id),
        supabase.from("profiles").delete().eq("id", user.id),
      ];

      await Promise.all(deletions);

      // Sign out
      await supabase.auth.signOut();

      toast({
        title: "Account deleted",
        description: "Your account and all data have been permanently deleted.",
      });

      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setConfirmText("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {step === 1 ? (
              <>
                <p className="font-medium text-foreground">This action is permanent and cannot be undone.</p>
                <p>Deleting your account will:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Remove all your conversations and messages</li>
                  <li>Delete all goals, habits, and progress data</li>
                  <li>Erase AI memories and predictions</li>
                  <li>Remove all uploaded documents and photos</li>
                  <li>Delete your profile and personal information</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">Final confirmation required</p>
                <p className="text-sm">
                  Account: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{userEmail}</span>
                </p>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="DELETE"
                    className="font-mono"
                    disabled={loading}
                  />
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading} className="w-full sm:w-auto">
            Cancel
          </Button>
          {step === 1 ? (
            <Button
              variant="destructive"
              onClick={() => setStep(2)}
              className="w-full sm:w-auto gap-2"
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || confirmText !== "DELETE"}
              className="w-full sm:w-auto gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete Forever
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
