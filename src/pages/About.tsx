```tsx
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Linkedin, Mail } from "lucide-react";
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
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full pb-20">
        <AboutSection />

        <div className="mt-8 flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-center">
            StudyTime Team
          </h2>

          <Button
            variant="outline"
            className="w-full gap-2"
            asChild
          >
            <a
              href="https://www.linkedin.com/in/masoud-salik-799187383/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin className="h-4 w-4" />
              Masoud Salik — LinkedIn
            </a>
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2"
            asChild
          >
            <a
              href="https://my.linkedin.com/in/fatimasalik"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin className="h-4 w-4" />
              Fatima Salik — LinkedIn
            </a>
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2"
            asChild
          >
            <a href="mailto:studytime.contact2@gmail.com">
              <Mail className="h-4 w-4" />
              Contact StudyTime
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
```
