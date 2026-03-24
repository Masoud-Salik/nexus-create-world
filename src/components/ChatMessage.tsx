import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Edit2, Check, RotateCw, User, Bot, Sparkles, Volume2 } from "lucide-react";
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
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard",
    });
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

  return (
    <div
      className={`group relative py-6 px-4 transition-colors duration-200 ${
        role === "user" 
          ? "bg-background hover:bg-muted/30" 
          : "bg-muted/30 hover:bg-muted/50"
      } message-enter`}
    >
      <div className="mx-auto max-w-3xl flex gap-4">
        {/* Avatar */}
        <div
          className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl shadow-lg transition-transform duration-200 group-hover:scale-105 ${
            role === "user"
              ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
              : "bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground border border-border/50"
          }`}
        >
          {role === "user" ? (
            <User className="h-4 w-4" />
          ) : (
            <div className="relative">
              <Bot className="h-4 w-4" />
              <Sparkles className="h-2 w-2 absolute -top-1 -right-1 text-primary animate-pulse" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Role Label */}
          <div className="text-xs font-medium text-muted-foreground mb-1.5">
            {role === "user" ? "You" : "AI Coach"}
          </div>

          {isEditing ? (
            <div className="flex gap-2 items-start animate-fade-in">
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSave();
                  }
                  if (e.key === "Escape") {
                    onCancelEdit?.();
                  }
                }}
              />
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSave}
                  className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
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
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  navigator.clipboard.writeText(String(children));
                                  toast({
                                    title: "Copied!",
                                    description: "Code copied to clipboard",
                                  });
                                }}
                                className="h-6 w-6 opacity-0 group-hover/code:opacity-100 transition-opacity"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <SyntaxHighlighter
                              style={oneDark}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-lg !mt-0 !pt-10"
                              {...props}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className={`${className} bg-muted px-1.5 py-0.5 rounded text-sm font-mono`} {...props}>
                            {children}
                          </code>
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
              <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                  title="Copy message"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
                {role === "assistant" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSpeak}
                    className={`h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary ${isSpeaking ? 'text-primary bg-primary/10' : ''}`}
                    title={isSpeaking ? "Stop speaking" : "Read aloud"}
                  >
                    <Volume2 className={`h-3 w-3 ${isSpeaking ? 'animate-pulse' : ''}`} />
                    {isSpeaking ? "Stop" : "Read"}
                  </Button>
                )}
                {role === "user" && onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onEdit}
                    className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                    title="Edit message"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Button>
                )}
                {role === "assistant" && isLastAssistant && onRegenerate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onRegenerate}
                    className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                    title="Regenerate response"
                  >
                    <RotateCw className="h-3 w-3" />
                    Regenerate
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
