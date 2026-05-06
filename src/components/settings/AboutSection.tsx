import { Sparkles, Target, Heart, Rocket, Brain, Globe, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import teamPhoto from "@/assets/team-photo.jpeg";
import appLogo from "@/assets/app-logo.png";

const values = [
  {
    icon: Brain,
    title: "AI-Powered Learning",
    description: "Intelligent study plans that adapt to your pace, strengths, and goals.",
  },
  {
    icon: Target,
    title: "Purpose-Driven Focus",
    description: "Every feature is designed to maximize deep work and minimize distractions.",
  },
  {
    icon: Globe,
    title: "Accessible to All",
    description: "Built for students everywhere — no matter where you start, we help you grow.",
  },
];

export function AboutSection() {
  return (
    <div className="space-y-6 py-2">
      {/* Team Photo */}
      <div className="rounded-2xl overflow-hidden shadow-lg">
        <img
          src={teamPhoto}
          alt="Meet the StudyTime team — Masoud Salik and Fatima Salik"
          className="w-full h-auto object-cover"
          loading="lazy"
        />
      </div>

      {/* Mission */}
      <Card>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Our Mission</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To empower every student with AI-driven tools that make studying more effective, 
            consistent, and rewarding — turning ambition into achievement, one session at a time.
          </p>
        </CardContent>
      </Card>

      {/* Values */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          What We Stand For
        </h3>
        <div className="space-y-2">
          {values.map((v) => (
            <Card key={v.title}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                  <v.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{v.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {v.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center space-y-2 pt-2">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span>Powered by</span>
          <span className="font-medium text-foreground">React</span>
          <span>·</span>
          <span className="font-medium text-foreground">Lovable Cloud</span>
          <span>·</span>
          <span className="font-medium text-foreground">AI</span>
          <Rocket className="h-3 w-3 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> by young minds
        </p>
      </div>
    </div>
  );
}
