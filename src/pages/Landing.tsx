import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  Timer, Brain, Trophy, BarChart3, Sparkles,
  ArrowRight, ChevronDown, Zap, BookOpen, Target, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import appLogo from "@/assets/app-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
  }),
};

const features = [
  {
    icon: Timer,
    title: "Focus Timer",
    desc: "Pomodoro-style deep work sessions with ambient sounds and streaks.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Brain,
    title: "AI Study Tutor",
    desc: "Chat with NEXUS — your personal AI that knows your goals and progress.",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: Target,
    title: "Smart Planner",
    desc: "AI-generated daily study plans that adapt when you're tired or motivated.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Trophy,
    title: "Leaderboard & XP",
    desc: "Earn XP, climb tiers, and compete with students worldwide.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: BarChart3,
    title: "Study Analytics",
    desc: "Heatmaps, streak calendars, and subject breakdowns to track growth.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: BookOpen,
    title: "Subject Manager",
    desc: "Organize subjects with icons, colors, and weekly targets.",
    color: "from-indigo-500 to-blue-500",
  },
];

const techStack = [
  "React 18", "TypeScript", "Tailwind CSS", "Supabase",
  "Edge Functions", "AI / LLM", "PWA", "Framer Motion",
];

export default function Landing() {
  usePageMeta({ title: "StudyTime — AI Study Companion", description: "AI-powered study companion for focused learning." });
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate("/", { replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) return null;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center">
        {/* Gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
        </div>

        <motion.div initial="hidden" animate="visible" className="relative z-10 max-w-3xl mx-auto space-y-8">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Open-source AI study platform
          </motion.div>

          <motion.div variants={fadeUp} custom={0.5} className="flex justify-center">
            <img src={appLogo} alt="StudyTime" className="w-20 h-20 rounded-2xl shadow-lg" />
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            Study smarter with{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              AI
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Focus timers, smart study plans, an AI tutor, and a global leaderboard — all in one app built for students who want results.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2 text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/25" onClick={() => navigate("/chat")}>
              Get Started <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 text-base px-8 py-6 rounded-xl" onClick={() => navigate("/")}>
              Try Demo
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8"
        >
          <ChevronDown className="h-6 w-6 text-muted-foreground animate-bounce" />
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16 space-y-4"
          >
            <h2 className="text-3xl sm:text-4xl font-bold">Everything you need to excel</h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Built with the same technologies used by top tech companies.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group relative rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${f.color} mb-4`}>
                  <f.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-2xl sm:text-3xl font-bold">Built with modern technology</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Production-grade architecture using industry-standard tools.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {techStack.map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 rounded-full border border-border/60 bg-muted/30 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                {tech}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center space-y-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 sm:p-14"
        >
          <div className="inline-flex p-4 rounded-2xl bg-primary/10">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold">Start studying smarter today</h2>
          <p className="text-muted-foreground">
            Join students who use AI to stay focused, track progress, and achieve their goals.
          </p>
          <Button size="lg" className="gap-2 text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/25" onClick={() => navigate("/chat")}>
            Get Started — It's Free <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={appLogo} alt="StudyTime" className="w-6 h-6 rounded-md" />
            <span className="font-semibold text-foreground">StudyTime</span>
          </div>
          <div className="flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" />
            <span>Built for students everywhere</span>
          </div>
        </div>
      </footer>
    </div>
  );
}