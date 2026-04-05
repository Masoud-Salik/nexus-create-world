import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AboutSection } from "@/components/settings/AboutSection";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function About() {
  usePageMeta({ title: "About StudyTime", description: "Learn about StudyTime's mission and team." });
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background px-3 py-4 sm:p-6">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
      <div className="flex-1 max-w-lg mx-auto w-full pb-20">
        <AboutSection />
      </div>
    </div>
  );
}
