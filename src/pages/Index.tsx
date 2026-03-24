import { useState, useRef, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Plus, MessageSquare, Sparkles, StopCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@/components/Auth";
import { Onboarding } from "@/components/Onboarding";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatTopBar } from "@/components/ChatTopBar";
import { TypingIndicator } from "@/components/TypingIndicator";
import { QuickActionChips } from "@/components/QuickActionChips";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { getTimeOfDay, getLocalTime } from "@/utils/getTimeOfDay";
import { getUserFriendlyError, logError } from "@/utils/errorUtils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Message = { role: "user" | "assistant"; content: string };

const Index = () => {
  usePageMeta({ title: "AI Chat", description: "Chat with your personal AI life coach for guidance, motivation, and personalized advice." });
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    }
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;
    
    setCheckingOnboarding(true);
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_completed, name')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setUserName(data.name || undefined);
      if (!data.onboarding_completed) {
        setNeedsOnboarding(true);
      } else {
        setNeedsOnboarding(false);
        loadOrCreateConversation();
      }
    }
    setCheckingOnboarding(false);
  };

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
    loadOrCreateConversation();
  };

  const loadConversations = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (data) {
      setConversations(data);
      if (data.length > 0 && !conversationId) {
        setConversationId(data[0].id);
        loadMessages(data[0].id);
      }
    }
  };

  const loadOrCreateConversation = async () => {
    if (!user) return;

    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (conversations && conversations.length > 0) {
      setConversations([conversations[0]]);
      setConversationId(conversations[0].id);
      loadMessages(conversations[0].id);
    } else {
      await createNewChat();
    }
    loadConversations();
  };

  const createNewChat = async () => {
    if (!user) return;

    // Check if current chat is already empty (new chat exists)
    if (conversationId && messages.length === 0) {
      // Already on a new empty chat, just close the sheet
      setShowChatList(false);
      toast({
        title: "Already on new chat",
        description: "Start typing to begin",
      });
      return;
    }

    // Check if there's an existing empty chat we can switch to
    const existingEmpty = conversations.find(c => 
      c.title === "New Chat" && c.id !== conversationId
    );
    
    if (existingEmpty) {
      // Load this chat and check if it has messages
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', existingEmpty.id)
        .limit(1);
      
      if (!existingMessages || existingMessages.length === 0) {
        // Switch to existing empty chat
        setConversationId(existingEmpty.id);
        setMessages([]);
        setShowChatList(false);
        return;
      }
    }

    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ 
        user_id: user.id, 
        title: "New Chat",
        local_time: getLocalTime(),
        time_of_day: getTimeOfDay()
      })
      .select()
      .single();
    
    if (newConv) {
      setConversationId(newConv.id);
      setMessages([]);
      setShowChatList(false); // Close the chat list sheet
      await loadConversations(); // Refresh the list
      toast({
        title: "New chat created",
        description: "Start a fresh conversation",
      });
    }
  };

  const generateChatTitle = async (convId: string, userMessage: string, assistantMessage: string) => {
    try {
      const { data } = await supabase.functions.invoke("generate-chat-title", {
        body: { userMessage, assistantMessage }
      });

      if (data?.title) {
        await supabase
          .from("conversations")
          .update({ title: data.title })
          .eq("id", convId);
        
        setConversations(prev => 
          prev.map(c => c.id === convId ? { ...c, title: data.title } : c)
        );
      }
    } catch (error) {
      console.error("Failed to generate chat title:", error);
    }
  };

  const switchChat = (chatId: string) => {
    setConversationId(chatId);
    loadMessages(chatId);
    setShowChatList(false);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  };

  const saveMessage = async (role: string, content: string) => {
    if (!conversationId || !user) return;

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role,
      content,
      local_time: getLocalTime(),
      time_of_day: getTimeOfDay()
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSaveEdit = async (index: number, newContent: string) => {
    if (!newContent.trim()) return;
    
    const updatedMessages = [...messages];
    updatedMessages[index].content = newContent;
    setMessages(updatedMessages);
    
    if (conversationId && user) {
      const messageToUpdate = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .order('created_at')
        .limit(index + 1);
      
      if (messageToUpdate.data && messageToUpdate.data[index]) {
        await supabase
          .from('messages')
          .update({ content: newContent })
          .eq('id', messageToUpdate.data[index].id);
      }
    }
    
    setEditingIndex(null);
    toast({
      title: "Updated!",
      description: "Message has been edited",
    });
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      toast({
        title: "Stopped",
        description: "Generation stopped",
      });
    }
  };

  const handleRegenerate = async () => {
    if (messages.length < 2) return;
    
    // Remove the last assistant message
    const newMessages = messages.slice(0, -1);
    setMessages(newMessages);
    
    // Delete the last message from database
    if (conversationId && user) {
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (allMessages && allMessages[0]) {
        await supabase
          .from('messages')
          .delete()
          .eq('id', allMessages[0].id);
      }
    }
    
    // Regenerate with the previous user message
    const lastUserMessage = newMessages[newMessages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
      await handleSend(lastUserMessage.content, false, true);
    }
  };

  const getUserContext = async () => {
    if (!user) return "";

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Fetch user goals
    const { data: goals } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id);

    // Fetch recent activities (last 30 days)
    const { data: activities } = await supabase
      .from("daily_activities")
      .select("*")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(30);

    // Fetch abilities and skills
    const { data: abilities } = await supabase
      .from("abilities_skills")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch interests
    const { data: interests } = await supabase
      .from("interests")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch friends
    const { data: friends } = await supabase
      .from("friends_identities")
      .select("*")
      .eq("user_id", user.id);

    let contextString = "";

    if (profile) {
      contextString += `\n\nUser Profile:
- Name: ${profile.name || "Not set"}
- Age: ${profile.age || "Not set"}
- Occupation: ${profile.occupation_or_status || "Not set"}
- Personal Motto: ${profile.personal_motto || "Not set"}`;
    }

    if (goals && goals.length > 0) {
      contextString += `\n\nUser Goals:`;
      goals.forEach((goal: any) => {
        contextString += `\n- ${goal.goal_title}: ${goal.goal_description || "No description"} (Duration: ${goal.goal_duration_days} days, Reminder: ${goal.reminder_enabled ? "On" : "Off"})`;
      });
    }

    if (abilities) {
      contextString += `\n\nAbilities & Skills:`;
      if (abilities.technical_skills?.length > 0) {
        contextString += `\n- Technical Skills: ${abilities.technical_skills.join(", ")}`;
      }
      if (abilities.soft_skills?.length > 0) {
        contextString += `\n- Soft Skills: ${abilities.soft_skills.join(", ")}`;
      }
      if (abilities.languages?.length > 0) {
        contextString += `\n- Languages: ${abilities.languages.join(", ")}`;
      }
      if (abilities.strengths?.length > 0) {
        contextString += `\n- Strengths: ${abilities.strengths.join(", ")}`;
      }
      if (abilities.weaknesses?.length > 0) {
        contextString += `\n- Areas for Growth: ${abilities.weaknesses.join(", ")}`;
      }
    }

    if (interests) {
      contextString += `\n\nInterests & Preferences:`;
      if (interests.clothing_style?.length > 0) {
        contextString += `\n- Clothing Style: ${interests.clothing_style.join(", ")}`;
      }
      if (interests.favorite_foods?.length > 0) {
        contextString += `\n- Favorite Foods: ${interests.favorite_foods.join(", ")}`;
      }
      if (interests.hobbies?.length > 0) {
        contextString += `\n- Hobbies: ${interests.hobbies.join(", ")}`;
      }
      if (interests.music?.length > 0) {
        contextString += `\n- Music: ${interests.music.join(", ")}`;
      }
      if (interests.movies_books?.length > 0) {
        contextString += `\n- Movies & Books: ${interests.movies_books.join(", ")}`;
      }
      if (interests.environment_preferences) {
        contextString += `\n- Environment Preferences: ${interests.environment_preferences}`;
      }
      if (interests.sleep_habits) {
        contextString += `\n- Sleep Habits: ${interests.sleep_habits}`;
      }
    }

    if (friends && friends.length > 0) {
      contextString += `\n\nFriends & Social Circle:`;
      friends.forEach((friend: any) => {
        contextString += `\n- ${friend.friend_name} (${friend.relationship || "Friend"})`;
        if (friend.personality_notes) {
          contextString += `: ${friend.personality_notes}`;
        }
        if (friend.influence_level) {
          contextString += ` [Influence: ${friend.influence_level}/5]`;
        }
      });
    }

    if (activities && activities.length > 0) {
      contextString += `\n\nRecent Activities (last ${activities.length} days):`;
      activities.forEach((activity: any) => {
        contextString += `\n- ${activity.activity_date}: Mood: ${activity.mood || "Not recorded"}`;
        if (activity.activities && Array.isArray(activity.activities)) {
          contextString += `, Activities: ${JSON.stringify(activity.activities)}`;
        }
        if (activity.notes) {
          contextString += `, Notes: ${activity.notes}`;
        }
      });
    }

    return contextString;
  };

  const handleGetStarted = async () => {
    const userContext = await getUserContext();
    const displayMessage = "Get Started";
    
    const userMessage: Message = { role: "user", content: displayMessage };
    setMessages([userMessage]);
    await saveMessage("user", displayMessage);
    setIsLoading(true);

    let assistantContent = "";

    try {
      // Get user session token for secure authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: "Session expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          messages: [userMessage], 
          userContext,
          userLocalTime: getLocalTime(),
          userTimeOfDay: getTimeOfDay()
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a moment.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        if (response.status === 402) {
          toast({
            title: "Payment required",
            description: "Please add funds to your workspace.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
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
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

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
                if (last?.role === "assistant") {
                  return prev.map((m, i) => 
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      await saveMessage("assistant", assistantContent);
      
      // Auto-generate chat title for new chats (when this is the first exchange)
      const currentConv = conversations.find(c => c.id === conversationId);
      if (conversationId && currentConv && (currentConv.title === "New Chat" || currentConv.title?.startsWith("Chat "))) {
        generateChatTitle(conversationId, userMessage.content, assistantContent);
      }
      
      setIsLoading(false);
    } catch (error) {
      logError("Chat GetStarted", error);
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
      setMessages(prev => prev.slice(0, -1));
      setIsLoading(false);
    }
  };

  const extractMemory = async (messageContent: string, messageId?: string) => {
    try {
      // Check if AI learning is enabled
      const { data: profile } = await supabase
        .from("profiles")
        .select("ai_learning_enabled")
        .eq("id", user?.id)
        .single();

      if (!profile?.ai_learning_enabled) return;

      const { data, error } = await supabase.functions.invoke("extract-memory", {
        body: { message: messageContent, messageId }
      });

      if (error) {
        console.error("Extract memory error:", error);
        return;
      }

      if (data?.should_save && data.category && data.content) {
        await supabase.from("ai_memory").insert({
          user_id: user?.id,
          category: data.category,
          content: data.content,
          source_message_id: messageId || null
        });
        console.log("Memory saved:", data.category, data.content);
      }
    } catch (e) {
      console.error("Memory extraction failed:", e);
    }
  };

  const handleSend = async (messageText?: string, includeContext: boolean = false, isRegenerate: boolean = false) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading || !user) return;
    
    // Only add user message if not regenerating
    if (!isRegenerate) {
      const userMessage: Message = { role: "user", content: textToSend };
      setMessages(prev => [...prev, userMessage]);
      await saveMessage("user", textToSend);
      
      // Extract memory in background (fire and forget)
      extractMemory(textToSend);
    }
    
    if (!messageText) setInput("");
    setIsLoading(true);
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    
    // Instant scroll to bottom when sending
    setTimeout(() => scrollToBottom(true), 0);

    let assistantContent = "";
    let userContext = "";
    
    if (includeContext) {
      userContext = await getUserContext();
    }

    try {
      const messagesToSend = isRegenerate ? messages : [...messages, { role: "user", content: textToSend }];
      
      // Get user session token for secure authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: "Session expired",
          description: "Please sign in again.",
          variant: "destructive",
        });
        setIsLoading(false);
        abortControllerRef.current = null;
        return;
      }

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          messages: messagesToSend, 
          userContext,
          userLocalTime: getLocalTime(),
          userTimeOfDay: getTimeOfDay()
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a moment.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        if (response.status === 402) {
          toast({
            title: "Payment required",
            description: "Please add funds to your workspace.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
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
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

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
                if (last?.role === "assistant") {
                  return prev.map((m, i) => 
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      await saveMessage("assistant", assistantContent);
      
      // Auto-generate chat title for new chats (when this is the first exchange)
      const currentConv = conversations.find(c => c.id === conversationId);
      if (conversationId && !isRegenerate && currentConv && (currentConv.title === "New Chat" || currentConv.title?.startsWith("Chat "))) {
        generateChatTitle(conversationId, textToSend, assistantContent);
      }
      
      setIsLoading(false);
      abortControllerRef.current = null;
    } catch (error: any) {
      logError("Chat handleSend", error);
      
      if (error.name === 'AbortError') {
        // Request was aborted, don't show error
        return;
      }
      
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
      
      if (!isRegenerate) {
        setMessages(prev => prev.slice(0, -1));
      }
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  if (!user) {
    return <Auth />;
  }

  if (checkingOnboarding) {
    return (
      <div className="flex h-screen items-center justify-center particle-bg">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/20 animate-ping absolute inset-0" />
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center relative">
              <Sparkles className="h-8 w-8 text-primary-foreground animate-pulse" />
            </div>
          </div>
          <p className="text-muted-foreground animate-pulse">Initializing your AI coach...</p>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return <Onboarding userId={user.id} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen bg-background particle-bg">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b p-4 flex justify-between items-center glass sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Sheet open={showChatList} onOpenChange={setShowChatList}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="tap-effect hover:glow-sm">
                  <MessageSquare className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Your Conversations
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  <Button 
                    onClick={createNewChat} 
                    className="w-full tap-effect gap-2"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    New Conversation
                  </Button>
                  <ScrollArea className="h-[calc(100vh-200px)]">
                    <div className="space-y-2 pr-2">
                      {conversations.map((conv) => (
                        <Button
                          key={conv.id}
                          variant={conversationId === conv.id ? "secondary" : "ghost"}
                          className="w-full justify-start tap-effect group"
                          onClick={() => switchChat(conv.id)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="truncate">{conv.title}</span>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Sparkles className="h-5 w-5 text-primary animate-float" />
                <div className="absolute inset-0 bg-primary/20 blur-lg" />
              </div>
              <h1 className="text-xl font-semibold gradient-text">
                AI Life Coach
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ChatTopBar
              conversationId={conversationId}
              conversationTitle={conversations.find(c => c.id === conversationId)?.title || "New Chat"}
              onDeleteChat={async () => {
                if (!conversationId) return;
                
                await supabase.from("messages").delete().eq("conversation_id", conversationId);
                await supabase.from("conversations").delete().eq("id", conversationId);
                
                const remaining = conversations.filter(c => c.id !== conversationId);
                setConversations(remaining);
                
                if (remaining.length > 0) {
                  setConversationId(remaining[0].id);
                  loadMessages(remaining[0].id);
                } else {
                  await createNewChat();
                }
              }}
              onRenameChat={async (newTitle: string) => {
                if (!conversationId) return;
                
                await supabase
                  .from("conversations")
                  .update({ title: newTitle })
                  .eq("id", conversationId);
                
                setConversations(prev => 
                  prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c)
                );
              }}
            />
          </div>
        </div>
        
        {/* Messages Area */}
        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col">
              <WelcomeScreen 
                userName={userName}
                onGetStarted={handleGetStarted}
                isLoading={isLoading}
              />
              <div className="pb-4">
                <QuickActionChips 
                  onSelect={(prompt) => handleSend(prompt, true)}
                  disabled={isLoading}
                />
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  content={msg.content}
                  role={msg.role}
                  isEditing={editingIndex === idx}
                  onEdit={msg.role === "user" ? () => handleEdit(idx) : undefined}
                  onSaveEdit={(content) => handleSaveEdit(idx, content)}
                  onCancelEdit={() => setEditingIndex(null)}
                  onRegenerate={
                    msg.role === "assistant" && idx === messages.length - 1 && !isLoading
                      ? handleRegenerate
                      : undefined
                  }
                  isLastAssistant={msg.role === "assistant" && idx === messages.length - 1}
                />
              ))}
              {isLoading && !messages.find(m => m.role === "assistant" && m.content === "") && (
                <TypingIndicator />
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input Area */}
        <div className="sticky bottom-0 border-t p-4 glass z-10">
          <div className="mx-auto max-w-3xl">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask your AI coach anything..."
                  className="pr-4 h-12 text-base bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                  disabled={isLoading}
                />
              </div>
              {isLoading ? (
                <Button 
                  onClick={handleStopGeneration} 
                  size="icon" 
                  variant="outline"
                  className="h-12 w-12 flex-shrink-0 tap-effect"
                >
                  <StopCircle className="h-5 w-5" />
                </Button>
              ) : (
                <Button 
                  onClick={() => handleSend()} 
                  size="icon" 
                  className="h-12 w-12 flex-shrink-0 tap-effect bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" 
                  disabled={!input.trim()}
                >
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Press Enter to send • Your AI coach learns and adapts to you
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Index;
