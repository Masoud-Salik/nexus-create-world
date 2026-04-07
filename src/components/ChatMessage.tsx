import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Edit2, Check, RotateCw, User, Bot, Volume2, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessageProps {
  content: string;
  role: "user" | "assistant";
  isEditing?: boolean;
  onCopy?: () => void;
  onEdit?: () => void;
  onSaveEdit?: (content: string) => void;
  onCancelEdit?: () => void;
  onRegenerate?: () => void;
  isLastAssistant?: boolean;
}

export function ChatMessage({
  content,
  role,
  isEditing,
  onCopy,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onRegenerate,
  isLastAssistant,
}: ChatMessageProps) {
  const [editContent, setEditContent] = useState(content);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied!", description: "Message copied to clipboard" });
    onCopy?.();
  };

  const handleSave = () => {
    onSaveEdit?.(editContent);
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleFeedback = (type: "up" | "down") => {
    setFeedback(type);
    toast({ title: type === "up" ? "Thanks! 👍" : "Got it, we'll improve 🙏" });
  };

  return (
    <div className="group relative py-5 px-4 animate-slide-up-fade">
      <div className="mx-auto max-w-3xl flex gap-3">
        {/* Avatar - 32px circle */}
        <div
          className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full shadow-sm ${
            role === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground border border-border/50"
          }`}
        >
          {role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            {role === "user" ? "You" : "StudyTime AI"}
          </div>

          {isEditing ? (
            <div className="flex gap-2 items-start animate-fade-in">
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
                  if (e.key === "Escape") onCancelEdit?.();
                }}
              />
              <Button size="icon" variant="ghost" onClick={handleSave} className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <div className="relative group/code my-4">
                            <div className="absolute top-0 left-0 right-0 h-8 bg-muted/80 rounded-t-lg flex items-center justify-between px-3 text-xs text-muted-foreground">
                              <span className="font-mono">{match[1]}</span>
                              <Button
                                size="icon" variant="ghost"
                                onClick={() => { navigator.clipboard.writeText(String(children)); toast({ title: "Copied!" }); }}
                                className="h-6 w-6 opacity-0 group-hover/code:opacity-100 transition-opacity"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" className="rounded-lg !mt-0 !pt-10" {...props}>
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className={`${className} bg-muted px-1.5 py-0.5 rounded text-sm font-mono`} {...props}>{children}</code>
                        );
                      },
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap m-0 leading-relaxed">{content}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 mt-2">
                {/* Always visible for assistant: Copy */}
                {role === "assistant" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleSpeak}
                      className={`h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground ${isSpeaking ? 'text-primary' : ''}`}>
                      <Volume2 className={`h-3 w-3 ${isSpeaking ? 'animate-pulse' : ''}`} /> {isSpeaking ? "Stop" : "Read"}
                    </Button>
                    {/* Thumbs feedback */}
                    <div className="ml-1 flex gap-0.5">
                      <Button size="sm" variant="ghost" onClick={() => handleFeedback("up")}
                        className={`h-7 w-7 p-0 ${feedback === 'up' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleFeedback("down")}
                        className={`h-7 w-7 p-0 ${feedback === 'down' ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}>
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}

                {/* Hover-reveal for user: Edit */}
                {role === "user" && onEdit && (
                  <Button size="sm" variant="ghost" onClick={onEdit}
                    className="h-7 px-2 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                    <Edit2 className="h-3 w-3" /> Edit
                  </Button>
                )}
                {role === "user" && (
                  <Button size="sm" variant="ghost" onClick={handleCopy}
                    className="h-7 px-2 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                )}

                {/* Regenerate - hover reveal */}
                {role === "assistant" && isLastAssistant && onRegenerate && (
                  <Button size="sm" variant="ghost" onClick={onRegenerate}
                    className="h-7 px-2 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                    <RotateCw className="h-3 w-3" /> Regenerate
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
