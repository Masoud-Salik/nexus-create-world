import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Target, CheckCircle } from "lucide-react";

type Goal = {
  goal_title: string;
  goal_description: string;
  goal_duration_days: number;
  reminder_enabled: boolean;
};

type OnboardingProps = {
  userId: string;
  onComplete: () => void;
};

export const Onboarding = ({ userId, onComplete }: OnboardingProps) => {
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Identity data
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [motto, setMotto] = useState("");

  // Goals data
  const [goals, setGoals] = useState<Goal[]>([
    { goal_title: "", goal_description: "", goal_duration_days: 365, reminder_enabled: false }
  ]);

  // Load name from auth metadata if available
  useEffect(() => {
    const loadUserMeta = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.name) {
        setName(user.user_metadata.name);
      }
    };
    loadUserMeta();
  }, []);

  const addGoal = () => {
    setGoals([...goals, { goal_title: "", goal_description: "", goal_duration_days: 365, reminder_enabled: false }]);
  };

  const updateGoal = (index: number, field: keyof Goal, value: any) => {
    const newGoals = [...goals];
    newGoals[index] = { ...newGoals[index], [field]: value };
    setGoals(newGoals);
  };

  const removeGoal = (index: number) => {
    if (goals.length > 1) {
      setGoals(goals.filter((_, i) => i !== index));
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: name.trim() || null,
          age: age ? parseInt(age) : null,
          occupation_or_status: occupation.trim() || null,
          personal_motto: motto.trim() || null,
          onboarding_completed: true
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Insert goals (only non-empty ones)
      const validGoals = goals.filter(g => g.goal_title.trim());
      if (validGoals.length > 0) {
        const { error: goalsError } = await supabase
          .from('goals')
          .insert(validGoals.map(g => ({
            user_id: userId,
            goal_title: g.goal_title.trim(),
            goal_description: g.goal_description.trim() || null,
            goal_duration_days: g.goal_duration_days,
            reminder_enabled: g.reminder_enabled
          })));

        if (goalsError) throw goalsError;
      }

      toast({
        title: "Welcome aboard!",
        description: "Your journey begins now! 🚀",
      });

      onComplete();
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const screens = [
    // Welcome Screen
    <div key="welcome" className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
      <Sparkles className="h-16 w-16 text-primary" />
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Welcome to Future App!</h1>
        <p className="text-muted-foreground text-lg">
          Let's set up your profile and goals to get started on your journey
        </p>
      </div>
      <Button size="lg" onClick={() => setStep(1)}>
        Get Started
      </Button>
    </div>,

    // Identity Screen
    <Card key="identity">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Tell Us About Yourself
        </CardTitle>
        <CardDescription>
          Help us personalize your experience (all fields optional except name)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Your age"
            min="1"
            max="150"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="occupation">Occupation or Status</Label>
          <Input
            id="occupation"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="e.g., Student, Developer, Entrepreneur"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="motto">Personal Motto</Label>
          <Textarea
            id="motto"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            placeholder="A phrase that inspires you"
            rows={3}
          />
        </div>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setStep(0)}>
            Back
          </Button>
          <Button onClick={() => setStep(2)} disabled={!name.trim()}>
            Next
          </Button>
        </div>
      </CardContent>
    </Card>,

    // Goals Screen
    <Card key="goals">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          What Are Your Goals?
        </CardTitle>
        <CardDescription>
          Set goals you want to achieve (you can add more later)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {goals.map((goal, index) => (
          <div key={index} className="space-y-4 p-4 border rounded-lg">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Goal {index + 1}</h3>
              {goals.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGoal(index)}
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Goal Title *</Label>
              <Input
                value={goal.goal_title}
                onChange={(e) => updateGoal(index, 'goal_title', e.target.value)}
                placeholder="e.g., Learn a new language"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={goal.goal_description}
                onChange={(e) => updateGoal(index, 'goal_description', e.target.value)}
                placeholder="More details about your goal"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (days: 1-3650)</Label>
              <Input
                type="number"
                value={goal.goal_duration_days}
                onChange={(e) => updateGoal(index, 'goal_duration_days', parseInt(e.target.value) || 1)}
                min="1"
                max="3650"
              />
              <p className="text-xs text-muted-foreground">
                {goal.goal_duration_days} days ≈ {Math.round(goal.goal_duration_days / 30)} months ≈ {(goal.goal_duration_days / 365).toFixed(1)} years
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor={`reminder-${index}`}>Enable reminders</Label>
              <Switch
                id={`reminder-${index}`}
                checked={goal.reminder_enabled}
                onCheckedChange={(checked) => updateGoal(index, 'reminder_enabled', checked)}
              />
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={addGoal} className="w-full">
          + Add Another Goal
        </Button>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button onClick={() => setStep(3)} disabled={!goals.some(g => g.goal_title.trim())}>
            Next
          </Button>
        </div>
      </CardContent>
    </Card>,

    // Confirmation Screen
    <div key="confirmation" className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
      <CheckCircle className="h-16 w-16 text-primary" />
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">You're All Set!</h2>
        <p className="text-muted-foreground">
          Ready to start your journey, {name}?
        </p>
      </div>
      <div className="w-full max-w-md text-left space-y-4 p-6 bg-muted rounded-lg">
        <div>
          <p className="font-semibold">Profile Summary:</p>
          <p className="text-sm text-muted-foreground">Name: {name}</p>
          {age && <p className="text-sm text-muted-foreground">Age: {age}</p>}
          {occupation && <p className="text-sm text-muted-foreground">Occupation: {occupation}</p>}
        </div>
        <div>
          <p className="font-semibold">Goals:</p>
          {goals.filter(g => g.goal_title.trim()).map((goal, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              • {goal.goal_title} ({goal.goal_duration_days} days)
            </p>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(2)} disabled={isLoading}>
          Edit Goals
        </Button>
        <Button onClick={handleComplete} disabled={isLoading}>
          {isLoading ? "Setting up..." : "Complete Setup"}
        </Button>
      </div>
    </div>
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        {screens[step]}
      </div>
    </div>
  );
};
