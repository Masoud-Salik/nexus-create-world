```tsx
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AboutSection } from "@/components/settings/AboutSection";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function About() {
  usePageMeta({
    title: "About StudyTime",
    description: "Learn about StudyTime's mission and team.",
  });

  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background px-3 py-4 sm:p-6">
      <div className="mb-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 pb-20">
        <AboutSection />

        <div className="mt-6 flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full">
            <a
              href="https://www.linkedin.com/in/masoud-salik-799187383/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Masoud Salik — LinkedIn
            </a>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <a
              href="https://my.linkedin.com/in/fatimasalik"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fatima Salik — LinkedIn
            </a>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <a href="mailto:studytime.contact2@gmail.com">
              Contact StudyTime
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
```
