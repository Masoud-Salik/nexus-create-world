import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, GraduationCap, Globe, Target } from "lucide-react";

interface ProfileSetupProps {
  userId: string;
  onComplete: () => void;
}

const EDUCATION_LEVELS = [
  "High School",
  "Undergraduate",
  "Graduate",
  "PhD",
  "Self-Learning",
  "Professional",
];

const FIELDS_OF_INTEREST = [
  "Computer Science",
  "Engineering",
  "Medicine",
  "Business",
  "Law",
  "Arts & Design",
  "Natural Sciences",
  "Social Sciences",
  "Education",
  "Other",
];

const COUNTRIES = [
  "Afghanistan",
  "United States",
  "United Kingdom",
  "India",
  "Pakistan",
  "Germany",
  "Canada",
  "Australia",
  "Other",
];

export function ProfileSetup({ userId, onComplete }: ProfileSetupProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    country: "",
    education_level: "",
    field_of_interest: "",
    daily_study_hours: "2",
    financial_constraints: false,
  });

  useEffect(() => {
    loadExistingProfile();
  }, [userId]);

  const loadExistingProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setFormData({
        name: data.name || "",
        age: data.age?.toString() || "",
        country: data.country || "",
        education_level: data.education_level || "",
        field_of_interest: data.field_of_interest || "",
        daily_study_hours: data.daily_study_hours?.toString() || "2",
        financial_constraints: data.financial_constraints || false,
      });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        name: formData.name,
        age: parseInt(formData.age) || null,
        country: formData.country,
        education_level: formData.education_level,
        field_of_interest: formData.field_of_interest,
        daily_study_hours: parseFloat(formData.daily_study_hours) || 2,
        financial_constraints: formData.financial_constraints,
      })
      .eq("id", userId);

    setLoading(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save profile", variant: "destructive" });
      return;
    }

    toast({ title: "Profile saved!", description: "Your future predictions are ready" });
    onComplete();
  };

  const steps = [
    {
      title: "Basic Information",
      icon: User,
      content: (
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your name"
            />
          </div>
          <div>
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              placeholder="Your age"
              min={10}
              max={100}
            />
          </div>
          <div>
            <Label>Country</Label>
            <Select value={formData.country} onValueChange={(v) => setFormData({ ...formData, country: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      title: "Education",
      icon: GraduationCap,
      content: (
        <div className="space-y-4">
          <div>
            <Label>Education Level</Label>
            <Select value={formData.education_level} onValueChange={(v) => setFormData({ ...formData, education_level: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select your level" />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Field of Interest</Label>
            <Select value={formData.field_of_interest} onValueChange={(v) => setFormData({ ...formData, field_of_interest: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select your field" />
              </SelectTrigger>
              <SelectContent>
                {FIELDS_OF_INTEREST.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      title: "Goals & Constraints",
      icon: Target,
      content: (
        <div className="space-y-4">
          <div>
            <Label htmlFor="study-hours">Daily Study Hours Target</Label>
            <Input
              id="study-hours"
              type="number"
              value={formData.daily_study_hours}
              onChange={(e) => setFormData({ ...formData, daily_study_hours: e.target.value })}
              placeholder="Hours per day"
              min={0}
              max={16}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground mt-1">
              How many hours can you realistically study each day?
            </p>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Financial Constraints</p>
              <p className="text-sm text-muted-foreground">
                Enable for scholarship-focused advice
              </p>
            </div>
            <Switch
              checked={formData.financial_constraints}
              onCheckedChange={(v) => setFormData({ ...formData, financial_constraints: v })}
            />
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const isLastStep = step === steps.length - 1;
  const canProceed = step === 0 
    ? formData.name && formData.age && formData.country
    : step === 1 
    ? formData.education_level && formData.field_of_interest
    : true;

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>{currentStep.title}</CardTitle>
            <CardDescription>Step {step + 1} of {steps.length}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentStep.content}

        {/* Progress Dots */}
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? "bg-primary" : i < step ? "bg-primary/50" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={loading || !canProceed} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Complete Setup
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed} className="flex-1">
              Continue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
