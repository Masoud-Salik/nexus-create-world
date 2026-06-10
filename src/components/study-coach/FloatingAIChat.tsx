import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTimeOfDay, getLocalTime } from "@/utils/getTimeOfDay";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type MiniMessage = { role: "user" | "assistant"; content: string };

interface TaskContext {
  subject: string;
  topic: string;
  elapsedMinutes?: number;
}

export function FloatingAIChat({
  anchor = "default",
  taskContext,
  label,
}: {
  anchor?: "ring" | "blueprint" | "session" | "default";
  taskContext?: TaskContext;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MiniMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: MiniMessage = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    navigator.vibrate?.(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setIsLoading(false); return; }

      const allMessages = [...messages, userMsg];
      // Seed task context as a system-style preface (sent once via first message metadata)
      const contextPreface: MiniMessage[] = taskContext
        ? [{
            role: "user",
            content: `[Context — I'm currently studying: ${taskContext.subject} → "${taskContext.topic}"${
              taskContext.elapsedMinutes != null ? ` (${taskContext.elapsedMinutes}m elapsed)` : ""
            }. Tailor your answer to this topic.]`,
          }]
        : [];
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: [...contextPreface, ...allMessages].slice(-7),
          userLocalTime: getLocalTime(),
          userTimeOfDay: getTimeOfDay(),
        }),
      });

      if (!response.ok || !response.body) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }
    } catch (e) {
      console.error("Mini chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't respond right now. Try again! 🔄" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const displayMessages = messages.slice(-4);

  // Position presets:
  // - "ring": absolute, sits at the 60° outside the round timer ring (top-right diagonal), no overlap
  // - "blueprint": fixed bottom-right, above bottom nav, clear of cards
  // - "default": fixed bottom-right above nav
  const buttonWrapperCls =
    anchor === "ring"
      ? "fixed top-[88px] right-3 z-50"
      : anchor === "blueprint"
      ? "fixed right-3 bottom-[80px] z-50"
      : anchor === "session"
      ? "fixed left-3 bottom-[80px] z-50"
      : "fixed bottom-20 right-3 z-50";

  const overlayCls =
    anchor === "ring"
      ? "fixed top-[140px] right-3 left-3 sm:left-auto z-50 sm:max-w-sm sm:ml-auto animate-in fade-in-0 zoom-in-95 duration-200"
      : anchor === "session"
      ? "fixed left-3 right-3 bottom-[140px] sm:right-auto sm:max-w-sm z-50 animate-in fade-in-0 zoom-in-95 duration-200"
      : "fixed right-3 bottom-[140px] left-3 sm:left-auto z-50 sm:max-w-sm sm:ml-auto animate-in fade-in-0 zoom-in-95 duration-200";

  return (
    <>
      {/* Floating Button */}
      <div className={buttonWrapperCls}>
        <button
          onClick={() => { setIsOpen(prev => !prev); navigator.vibrate?.(10); }}
          className={cn(
            "relative rounded-full flex items-center justify-center shadow-lg gap-1.5",
            label ? "h-10 px-3" : "w-10 h-10",
            "bg-primary text-primary-foreground",
            "active:scale-95 transition-transform duration-150",
            !isOpen && "animate-[pulse-glow_3s_ease-in-out_infinite]"
          )}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {!isOpen && label && <span className="text-xs font-bold">{label}</span>}
        </button>
      </div>

      {/* Chat Overlay */}
      {isOpen && (
        <div className={overlayCls}>
          <div className="rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Mini header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">NEXUS</span>
                {taskContext && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                    · {taskContext.topic}
                  </span>
                )}
                {isLoading && <span className="text-[10px] text-muted-foreground animate-pulse">thinking...</span>}
              </div>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="max-h-48 overflow-y-auto px-3 py-2 space-y-2">
              {displayMessages.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 space-y-2">
                  <p>Ask me anything while you study! 🧠</p>
                  {taskContext && (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {[
                        "Explain this concept",
                        "Give me a practice question",
                        "Quick summary please",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => setInput(q)}
                          className="px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] hover:bg-primary/20"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {displayMessages.map((msg, i) => (
                <div key={i} className={cn("text-xs leading-relaxed", msg.role === "user" ? "text-right" : "text-left")}>
                  <span className={cn(
                    "inline-block max-w-[85%] px-2.5 py-1.5 rounded-xl",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}>
                    {msg.content}
                  </span>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border/30">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder="Quick question..."
                className="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground/60 text-foreground"
                maxLength={500}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-40 active:scale-90 transition-transform"
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}