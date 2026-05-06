import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Plus, MessageSquare, Sparkles, StopCircle, Menu, Edit3, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@/components/Auth";
import { Onboarding } from "@/components/Onboarding";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChatMessage } from "@/components/ChatMessage";
import { TypingIndicator } from "@/components/TypingIndicator";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { getTimeOfDay, getLocalTime } from "@/utils/getTimeOfDay";
import { getUserFriendlyError, logError } from "@/utils/errorUtils";
import { isToday, isYesterday, subDays, isAfter } from "date-fns";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Message = { role: "user" | "assistant"; content: string };

// Group conversations by date
function groupConversations(conversations: any[]) {
  const groups: { label: string; items: any[] }[] = [];
  const pinned: any[] = [];
  const today: any[] = [];
  const yesterday: any[] = [];
  const last7: any[] = [];
  const older: any[] = [];

  const sevenDaysAgo = subDays(new Date(), 7);

  for (const c of conversations) {
    if (c.is_pinned) { pinned.push(c); continue; }
    const d = new Date(c.updated_at || c.created_at);
    if (isToday(d)) today.push(c);
    else if (isYesterday(d)) yesterday.push(c);
    else if (isAfter(d, sevenDaysAgo)) last7.push(c);
    else older.push(c);
  }

  if (pinned.length) groups.push({ label: "📌 Pinned", items: pinned });
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (last7.length) groups.push({ label: "Previous 7 Days", items: last7 });
  if (older.length) groups.push({ label: "Older", items: older });
  return groups;
}

const Index = () => {
  usePageMeta({ title: "AI Chat", description: "Chat with your personal AI study companion." });
  const [user, setUser] = useState<any>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showChatList, setShowChatList] = useState(false);
  const [userName, setUserName] = useState<string | undefined>();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
  };

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; // max ~5 rows
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) checkOnboardingStatus();
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;
    setCheckingOnboarding(true);
    const { data } = await supabase.from('profiles').select('onboarding_completed, name').eq('id', user.id).single();
    if (data) {
      setUserName(data.name || undefined);
      if (!data.onboarding_completed) { setNeedsOnboarding(true); }
      else { setNeedsOnboarding(false); loadOrCreateConversation(); }
    }
    setCheckingOnboarding(false);
  };

  const handleOnboardingComplete = () => { setNeedsOnboarding(false); loadOrCreateConversation(); };

  const loadConversations = async () => {
    if (!user) return;
    const { data } = await supabase.from('conversations').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
    if (data) {
      setConversations(data);
      if (data.length > 0 && !conversationId) { setConversationId(data[0].id); loadMessages(data[0].id); }
    }
  };

  const loadOrCreateConversation = async () => {
    if (!user) return;
    const { data: convs } = await supabase.from('conversations').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1);
    if (convs && convs.length > 0) { setConversations([convs[0]]); setConversationId(convs[0].id); loadMessages(convs[0].id); }
    else { await createNewChat(); }
    loadConversations();
  };

  const createNewChat = async () => {
    if (!user) return;
    if (conversationId && messages.length === 0) { setShowChatList(false); return; }
    const existingEmpty = conversations.find(c => c.title === "New Chat" && c.id !== conversationId);
    if (existingEmpty) {
      const { data: msgs } = await supabase.from('messages').select('id').eq('conversation_id', existingEmpty.id).limit(1);
      if (!msgs || msgs.length === 0) { setConversationId(existingEmpty.id); setMessages([]); setShowChatList(false); return; }
    }
    const { data: newConv } = await supabase.from('conversations').insert({ user_id: user.id, title: "New Chat", local_time: getLocalTime(), time_of_day: getTimeOfDay() }).select().single();
    if (newConv) { setConversationId(newConv.id); setMessages([]); setShowChatList(false); await loadConversations(); }
  };

  const generateChatTitle = async (convId: string, userMessage: string, assistantMessage: string) => {
    try {
      const { data } = await supabase.functions.invoke("generate-chat-title", { body: { userMessage, assistantMessage } });
      if (data?.title) {
        await supabase.from("conversations").update({ title: data.title }).eq("id", convId);
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: data.title } : c));
      }
    } catch (error) { console.error("Failed to generate chat title:", error); }
  };

  const switchChat = (chatId: string) => { setConversationId(chatId); loadMessages(chatId); setShowChatList(false); };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    if (data) setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
  };

  const saveMessage = async (role: string, content: string) => {
    if (!conversationId || !user) return;
    await supabase.from('messages').insert({ conversation_id: conversationId, user_id: user.id, role, content, local_time: getLocalTime(), time_of_day: getTimeOfDay() });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleEdit = (index: number) => setEditingIndex(index);

  const handleSaveEdit = async (index: number, newContent: string) => {
    if (!newContent.trim()) return;
    const updatedMessages = [...messages]; updatedMessages[index].content = newContent; setMessages(updatedMessages);
    if (conversationId && user) {
      const messageToUpdate = await supabase.from('messages').select('id').eq('conversation_id', conversationId).order('created_at').limit(index + 1);
      if (messageToUpdate.data && messageToUpdate.data[index]) await supabase.from('messages').update({ content: newContent }).eq('id', messageToUpdate.data[index].id);
    }
    setEditingIndex(null);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; setIsLoading(false); }
  };

  const handleRegenerate = async () => {
    if (messages.length < 2) return;
    const newMessages = messages.slice(0, -1); setMessages(newMessages);
    if (conversationId && user) {
      const { data: allMessages } = await supabase.from('messages').select('id').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1);
      if (allMessages && allMessages[0]) await supabase.from('messages').delete().eq('id', allMessages[0].id);
    }
    const lastUserMessage = newMessages[newMessages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") await handleSend(lastUserMessage.content, false, true);
  };

  const getUserContext = async () => {
    if (!user) return "";
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    const { data: goals } = await supabase.from("goals").select("*").eq("user_id", user.id);
    const { data: activities } = await supabase.from("daily_activities").select("*").eq("user_id", user.id).order("activity_date", { ascending: false }).limit(30);
    const { data: abilities } = await supabase.from("abilities_skills").select("*").eq("user_id", user.id).maybeSingle();
    const { data: interests } = await supabase.from("interests").select("*").eq("user_id", user.id).maybeSingle();
    const { data: friends } = await supabase.from("friends_identities").select("*").eq("user_id", user.id);

    let ctx = "";
    if (profile) ctx += `\n\nUser Profile:\n- Name: ${profile.name || "Not set"}\n- Age: ${profile.age || "Not set"}\n- Occupation: ${profile.occupation_or_status || "Not set"}\n- Personal Motto: ${profile.personal_motto || "Not set"}`;
    if (goals?.length) { ctx += `\n\nUser Goals:`; goals.forEach((g: any) => { ctx += `\n- ${g.goal_title}: ${g.goal_description || ""} (${g.goal_duration_days}d)`; }); }
    if (abilities) {
      ctx += `\n\nAbilities:`;
      if (abilities.technical_skills?.length) ctx += `\n- Tech: ${abilities.technical_skills.join(", ")}`;
      if (abilities.soft_skills?.length) ctx += `\n- Soft: ${abilities.soft_skills.join(", ")}`;
      if (abilities.languages?.length) ctx += `\n- Languages: ${abilities.languages.join(", ")}`;
      if (abilities.strengths?.length) ctx += `\n- Strengths: ${abilities.strengths.join(", ")}`;
      if (abilities.weaknesses?.length) ctx += `\n- Growth: ${abilities.weaknesses.join(", ")}`;
    }
    if (interests) {
      ctx += `\n\nInterests:`;
      if (interests.hobbies?.length) ctx += `\n- Hobbies: ${interests.hobbies.join(", ")}`;
      if (interests.music?.length) ctx += `\n- Music: ${interests.music.join(", ")}`;
    }
    if (friends?.length) { ctx += `\n\nFriends:`; friends.forEach((f: any) => { ctx += `\n- ${f.friend_name} (${f.relationship || "Friend"})`; }); }
    if (activities?.length) { ctx += `\n\nRecent Activities:`; activities.slice(0, 10).forEach((a: any) => { ctx += `\n- ${a.activity_date}: Mood: ${a.mood || "?"}`; }); }
    return ctx;
  };

  const extractMemory = async (messageContent: string, messageId?: string) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("ai_learning_enabled").eq("id", user?.id).single();
      if (!profile?.ai_learning_enabled) return;
      const { data, error } = await supabase.functions.invoke("extract-memory", { body: { message: messageContent, messageId } });
      if (error) return;
      if (data?.should_save && data.category && data.content) {
        await supabase.from("ai_memory").insert({ user_id: user?.id, category: data.category, content: data.content, source_message_id: messageId || null });
      }
    } catch (e) { console.error("Memory extraction failed:", e); }
  };

  const handleSend = async (messageText?: string, includeContext: boolean = false, isRegenerate: boolean = false) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;
    if (!user) { toast({ title: "Sign in to chat", description: "Create an account to use the AI chat feature" }); return; }

    if (!isRegenerate) {
      const userMessage: Message = { role: "user", content: textToSend };
      setMessages(prev => [...prev, userMessage]);
      await saveMessage("user", textToSend);
      extractMemory(textToSend);
    }

    if (!messageText) setInput("");
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    setTimeout(() => scrollToBottom(true), 0);

    // Reset textarea height
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    let assistantContent = "";
    let userContext = "";
    if (includeContext) userContext = await getUserContext();

    try {
      const messagesToSend = isRegenerate ? messages : [...messages, { role: "user", content: textToSend }];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" }); setIsLoading(false); return; }

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: messagesToSend, userContext, userLocalTime: getLocalTime(), userTimeOfDay: getTimeOfDay() }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 429) { toast({ title: "Rate limit exceeded", variant: "destructive" }); setIsLoading(false); return; }
        if (response.status === 402) { toast({ title: "Payment required", variant: "destructive" }); setIsLoading(false); return; }
        throw new Error("Failed to start stream");
      }

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex); textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
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

      await saveMessage("assistant", assistantContent);
      const currentConv = conversations.find(c => c.id === conversationId);
      if (conversationId && !isRegenerate && currentConv && (currentConv.title === "New Chat" || currentConv.title?.startsWith("Chat "))) {
        generateChatTitle(conversationId, textToSend, assistantContent);
      }
      setIsLoading(false); abortControllerRef.current = null;
    } catch (error: any) {
      logError("Chat handleSend", error);
      if (error.name === 'AbortError') return;
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
      if (!isRegenerate) setMessages(prev => prev.slice(0, -1));
      setIsLoading(false); abortControllerRef.current = null;
    }
  };

  const handleSuggestion = (prompt: string) => {
    handleSend(prompt, true);
  };

  const isGuest = !user;
  const currentTitle = conversations.find(c => c.id === conversationId)?.title || "New Chat";

  if (user && checkingOnboarding) {
    return (
      <div className="flex h-screen items-center justify-center particle-bg">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/20 animate-ping absolute inset-0" />
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center relative">
              <Sparkles className="h-8 w-8 text-primary-foreground animate-pulse" />
            </div>
          </div>
          <p className="text-muted-foreground animate-pulse">Initializing...</p>
        </div>
      </div>
    );
  }

  if (user && needsOnboarding) return <Onboarding userId={user.id} onComplete={handleOnboardingComplete} />;

  const filteredConversations = chatSearch.trim()
    ? conversations.filter(c => (c.title || "").toLowerCase().includes(chatSearch.toLowerCase()))
    : conversations;
  const conversationGroups = groupConversations(filteredConversations);

  return (
    <div className="flex h-screen bg-background">
      {/* Guest Auth Dialog */}
      {isGuest && showAuthDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAuthDialog(false)}>
          <div onClick={(e) => e.stopPropagation()}><Auth /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Guest inline sign-in prompt */}
        {isGuest && (
          <div className="px-4 py-2 bg-primary/5 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Sign in to save your chats</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAuthDialog(true)}>Sign In</Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => setShowAuthDialog(true)}>Sign Up</Button>
            </div>
          </div>
        )}

        {/* Header — ChatGPT style: [≡] [title] [+ new chat] */}
        <div className="border-b px-4 py-3 flex items-center justify-between glass sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Sheet open={showChatList} onOpenChange={setShowChatList}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 tap-effect">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <div className="p-4 border-b space-y-2">
                  <Button onClick={createNewChat} className="w-full gap-2" variant="outline">
                    <Plus className="h-4 w-4" /> New Chat
                  </Button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={chatSearch}
                      onChange={e => setChatSearch(e.target.value)}
                      placeholder="Search chats..."
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>
                <ScrollArea className="h-[calc(100vh-80px)]">
                  <div className="p-2 space-y-4">
                    {conversationGroups.map((group) => (
                      <div key={group.label}>
                        <p className="text-xs font-semibold text-muted-foreground px-3 py-1">{group.label}</p>
                        {group.items.map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => switchChat(conv.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors tap-effect ${
                              conversationId === conv.id ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/50"
                            }`}
                          >
                            {conv.title || "New Chat"}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <h1 className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">
              {currentTitle}
            </h1>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 tap-effect" onClick={createNewChat}>
            <Edit3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <WelcomeScreen userName={userName} onSuggestion={handleSuggestion} />
          ) : (
            <div>
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  content={msg.content}
                  role={msg.role}
                  isEditing={editingIndex === idx}
                  onEdit={msg.role === "user" ? () => handleEdit(idx) : undefined}
                  onSaveEdit={(content) => handleSaveEdit(idx, content)}
                  onCancelEdit={() => setEditingIndex(null)}
                  onRegenerate={msg.role === "assistant" && idx === messages.length - 1 && !isLoading ? handleRegenerate : undefined}
                  isLastAssistant={msg.role === "assistant" && idx === messages.length - 1}
                />
              ))}
              {isLoading && !messages.find(m => m.role === "assistant" && m.content === "") && <TypingIndicator />}
            </div>
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input — auto-growing textarea */}
        <div className="sticky bottom-0 border-t p-3 sm:p-4 glass z-10">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 bg-background/80 border border-border/60 rounded-2xl px-3 py-2 focus-within:border-primary/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); adjustTextarea(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isLoading) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Message StudyTime AI..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent resize-none text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none py-1 max-h-40"
              />
              {isLoading ? (
                <Button onClick={handleStopGeneration} size="icon" variant="ghost" className="h-9 w-9 shrink-0 tap-effect">
                  <StopCircle className="h-5 w-5" />
                </Button>
              ) : (
                <Button onClick={() => handleSend()} size="icon" className="h-9 w-9 shrink-0 rounded-xl tap-effect bg-primary hover:bg-primary/90" disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-1.5">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
