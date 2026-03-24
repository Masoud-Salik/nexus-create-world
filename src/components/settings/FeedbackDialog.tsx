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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Loader2, Send, Star } from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEEDBACK_TYPES = [
  { value: "bug", label: "🐛 Bug Report", description: "Something isn't working" },
  { value: "feature", label: "💡 Feature Request", description: "Suggest an improvement" },
  { value: "general", label: "💬 General Feedback", description: "Share your thoughts" },
  { value: "praise", label: "⭐ Praise", description: "Tell us what you love" },
];

const RATING_EMOJIS = ["😢", "😕", "😐", "😊", "😍"];

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { toast } = useToast();
  const [type, setType] = useState("general");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: "Please enter your feedback",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // In a real app, you'd send this to your backend
      // For now, we'll simulate the submission
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create mailto link as fallback
      const subject = `[${type.toUpperCase()}] App Feedback${rating ? ` - Rating: ${rating}/5` : ""}`;
      const body = `Type: ${type}\nRating: ${rating ? `${rating}/5` : "Not rated"}\n\nMessage:\n${message}`;
      
      // Open email client
      window.location.href = `mailto:masoudsalik2024@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      setSubmitted(true);
      toast({
        title: "Thank you for your feedback! 🙏",
        description: "We appreciate you taking the time to help us improve.",
      });
    } catch (error) {
      toast({
        title: "Error sending feedback",
        description: "Please try again or email us directly",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setType("general");
    setRating(null);
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send Feedback
          </DialogTitle>
          <DialogDescription>
            Help us improve by sharing your thoughts
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="text-5xl">🎉</div>
            <div className="text-center">
              <p className="font-semibold text-lg">Thank You!</p>
              <p className="text-sm text-muted-foreground">
                Your feedback helps us make the app better for everyone.
              </p>
            </div>
            <Button onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Feedback Type */}
              <div className="space-y-2">
                <Label>Type of Feedback</Label>
                <RadioGroup value={type} onValueChange={setType} className="grid grid-cols-2 gap-2">
                  {FEEDBACK_TYPES.map((t) => (
                    <div key={t.value}>
                      <RadioGroupItem
                        value={t.value}
                        id={t.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={t.value}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                      >
                        <span className="text-sm font-medium">{t.label}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <Label>How do you feel about the app?</Label>
                <div className="flex justify-between items-center p-2 bg-muted rounded-lg">
                  {RATING_EMOJIS.map((emoji, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setRating(index + 1)}
                      className={`text-3xl p-2 rounded-full transition-all ${
                        rating === index + 1 
                          ? "bg-primary/20 scale-125" 
                          : "hover:bg-muted-foreground/10"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label>Your Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Feedback
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
