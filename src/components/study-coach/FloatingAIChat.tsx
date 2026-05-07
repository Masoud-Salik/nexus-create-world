import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Send, X, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTimeOfDay, getLocalTime } from "@/utils/getTimeOfDay";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type MiniMessage = { role: "user" | "assistant"; content: string };

// 3 snap positions as % from top of the safe area
const SNAP_POSITIONS = [12, 45, 72]; // top, middle, bottom

export function FloatingAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MiniMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [snapIndex, setSnapIndex] = useState(2); // start at bottom
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startTopRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getSnapY = (index: number) => SNAP_POSITIONS[index];

  // Touch handlers for drag
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    startTopRef.current = getSnapY(snapIndex);
    setIsDragging(true);
  }, [snapIndex]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaPercent = ((touch.clientY - startYRef.current) / window.innerHeight) * 100;
    const newY = Math.max(5, Math.min(80, startTopRef.current + deltaPercent));
    setDragY(newY);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const currentY = dragY ?? getSnapY(snapIndex);
    // Find nearest snap point
    let nearest = 0;
    let minDist = Infinity;
    SNAP_POSITIONS.forEach((pos, i) => {
      const dist = Math.abs(currentY - pos);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });
    setSnapIndex(nearest);
    setDragY(null);
    navigator.vibrate?.(10);
  }, [isDragging, dragY, snapIndex]);

  const handleButtonClick = () => {
    if (isDragging) return;
    setIsOpen(prev => !prev);
    navigator.vibrate?.(10);
  };

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
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: allMessages.slice(-6), // Last 6 for context, keep it light
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

  const currentTop = isDragging && dragY !== null ? dragY : getSnapY(snapIndex);
  const displayMessages = messages.slice(-4);

  // Determine if overlay should go above or below button
  const overlayAbove = snapIndex >= 1; // middle or bottom -> show above

  return (
    <>
      {/* Floating Button */}
      <div
        ref={buttonRef}
        className={cn(
          "fixed right-3 z-50 select-none",
          !isDragging && "transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        )}
        style={{ top: `${currentTop}%` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={handleButtonClick}
          className={cn(
            "relative w-11 h-11 rounded-full flex items-center justify-center shadow-lg",
            "bg-primary text-primary-foreground",
            "active:scale-95 transition-transform duration-150",
            "touch-none",
            !isOpen && "animate-[pulse-glow_3s_ease-in-out_infinite]"
          )}
          style={{ touchAction: "none" }}
        >
          {isOpen ? <Minus className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </button>
      </div>

      {/* Chat Overlay */}
      {isOpen && (
        <div
          className={cn(
            "fixed right-3 left-3 z-50 max-w-sm ml-auto",
            "animate-in fade-in-0 zoom-in-95 duration-200",
            !isDragging && "transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          )}
          style={{
            ...(overlayAbove
              ? { bottom: `${100 - currentTop + 2}%` }
              : { top: `${currentTop + 6}%` }),
          }}
        >
          <div className="rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Mini header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">NEXUS</span>
                {isLoading && <span className="text-[10px] text-muted-foreground animate-pulse">thinking...</span>}
              </div>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="max-h-48 overflow-y-auto px-3 py-2 space-y-2">
              {displayMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Ask me anything while you study! 🧠
                </p>
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