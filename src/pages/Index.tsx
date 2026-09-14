import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Send,
  Plus,
  Sparkles,
  StopCircle,
  Menu,
  Edit3,
  Search,
  Pin,
  PinOff,
  Trash2,
  Check,
  X,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { Auth } from "@/components/Auth";
import { Onboarding } from "@/components/Onboarding";
import { ChatMessage } from "@/components/ChatMessage";
import { TypingIndicator } from "@/components/TypingIndicator";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { AIProviderBanner } from "@/components/chat/AIProviderBanner";
import { apiStream } from "@/core/api/client";

import {
  getTimeOfDay,
  getLocalTime,
} from "@/utils/getTimeOfDay";

import {
  getUserFriendlyError,
  logError,
  requireAuth,
} from "@/utils/errorUtils";

import {
  isToday,
  isYesterday,
  subDays,
  isAfter,
} from "date-fns";


const ACTIVE_CHAT_KEY = "studytime-active-chat";

const LONG_PRESS_DURATION = 600;

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at?: string | null;
  is_pinned?: boolean;
};


/* ========================================================================= */
/*                         CONVERSATION GROUPING                             */
/* ========================================================================= */

function groupConversations(
  conversations: Conversation[]
) {
  const groups: {
    label: string;
    items: Conversation[];
  }[] = [];

  const pinned: Conversation[] = [];
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const last7: Conversation[] = [];
  const older: Conversation[] = [];

  const sevenDaysAgo = subDays(new Date(), 7);

  for (const conversation of conversations) {
    if (conversation.is_pinned) {
      pinned.push(conversation);
      continue;
    }

    const date = new Date(
      conversation.updated_at ||
      conversation.created_at
    );

    if (isToday(date)) {
      today.push(conversation);
    } else if (isYesterday(date)) {
      yesterday.push(conversation);
    } else if (isAfter(date, sevenDaysAgo)) {
      last7.push(conversation);
    } else {
      older.push(conversation);
    }
  }

  if (pinned.length) {
    groups.push({
      label: "Pinned",
      items: pinned,
    });
  }

  if (today.length) {
    groups.push({
      label: "Today",
      items: today,
    });
  }

  if (yesterday.length) {
    groups.push({
      label: "Yesterday",
      items: yesterday,
    });
  }

  if (last7.length) {
    groups.push({
      label: "Previous 7 Days",
      items: last7,
    });
  }

  if (older.length) {
    groups.push({
      label: "Older",
      items: older,
    });
  }

  return groups;
}


/* ========================================================================= */
/*                                  PAGE                                     */
/* ========================================================================= */

const Index = () => {
  usePageMeta({
    title: "AI Chat",
    description:
      "Chat with your personal AI study companion.",
  });

  /* ---------------------------------------------------------------------- */
  /* AUTH / ONBOARDING                                                      */
  /* ---------------------------------------------------------------------- */

  const [user, setUser] = useState<any>(null);

  const [needsOnboarding, setNeedsOnboarding] =
    useState(false);

  const [checkingOnboarding, setCheckingOnboarding] =
    useState(true);


  /* ---------------------------------------------------------------------- */
  /* CHAT STATE                                                             */
  /* ---------------------------------------------------------------------- */

  const [
    conversationId,
    setConversationId,
  ] = useState<string | null>(null);

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [input, setInput] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [editingIndex, setEditingIndex] =
    useState<number | null>(null);

  const [userName, setUserName] =
    useState<string | undefined>();


  /* ---------------------------------------------------------------------- */
  /* CHAT DRAWER                                                            */
  /* ---------------------------------------------------------------------- */

  const [showChatList, setShowChatList] =
    useState(false);

  const [chatSearch, setChatSearch] =
    useState("");

  const [drawerWidth, setDrawerWidth] =
    useState(280);

  const [dragX, setDragX] =
    useState<number | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startedOpen: boolean;
    active: boolean;
    locked: boolean;
  } | null>(null);


  /* ---------------------------------------------------------------------- */
  /* ACTION / SELECTION STATE                                               */
  /* ---------------------------------------------------------------------- */

  const [actionChat, setActionChat] =
    useState<Conversation | null>(null);

  const [showActionCard, setShowActionCard] =
    useState(false);

  const [selectionMode, setSelectionMode] =
    useState(false);

  const [selectedChats, setSelectedChats] =
    useState<Set<string>>(new Set());

  const [renamingChatId, setRenamingChatId] =
    useState<string | null>(null);

  const [renameValue, setRenameValue] =
    useState("");


  /* ---------------------------------------------------------------------- */
  /* AUTH DIALOG                                                            */
  /* ---------------------------------------------------------------------- */

  const [showAuthDialog, setShowAuthDialog] =
    useState(false);


  /* ---------------------------------------------------------------------- */
  /* REFS                                                                   */
  /* ---------------------------------------------------------------------- */

  const messagesEndRef =
    useRef<HTMLDivElement>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const longPressTimer =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const longPressTriggered =
    useRef(false);


  const { toast } = useToast();


  /* ========================================================================= */
  /*                         RESPONSIVE DRAWER WIDTH                           */
  /* ========================================================================= */

  useEffect(() => {
    const computeDrawerWidth = () => {
      const width = window.innerWidth;

      /*
       * Keep the original responsive idea:
       * roughly 65vw on small screens,
       * capped at 320px,
       * never smaller than 220px.
       */
      setDrawerWidth(
        Math.max(
          220,
          Math.min(320, Math.round(width * 0.65))
        )
      );
    };

    computeDrawerWidth();

    window.addEventListener(
      "resize",
      computeDrawerWidth
    );

    return () =>
      window.removeEventListener(
        "resize",
        computeDrawerWidth
      );
  }, []);


  /* ========================================================================= */
  /*                           SCROLL TO BOTTOM                                */
  /* ========================================================================= */

  const scrollToBottom = useCallback(
    (instant = false) => {
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? "auto" : "smooth",
        block: "end",
      });
    },
    []
  );


  /* ========================================================================= */
  /*                            TEXTAREA RESIZE                                */
  /* ========================================================================= */

  const adjustTextarea = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";

    textarea.style.height =
      `${Math.min(textarea.scrollHeight, 160)}px`;
  }, []);


  /* ========================================================================= */
  /*                               AUTH STATE                                  */
  /* ========================================================================= */

  useEffect(() => {
    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user ?? null);
        }
      );

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });

    return () =>
      subscription.unsubscribe();
  }, []);


  /* ========================================================================= */
  /*                         CLEANUP DRAG / TIMER                               */
  /* ========================================================================= */

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }

      document.body.classList.remove(
        "chat-typing"
      );
    };
  }, []);


  /* ========================================================================= */
  /*                           ONBOARDING CHECK                                 */
  /* ========================================================================= */

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    } else {
      setCheckingOnboarding(false);
      setNeedsOnboarding(false);
    }
  }, [user]);


  const checkOnboardingStatus = async () => {
    if (!user) return;

    setCheckingOnboarding(true);

    const { data } =
      await supabase
        .from("profiles")
        .select(
          "onboarding_completed, name"
        )
        .eq("id", user.id)
        .single();

    if (data) {
      setUserName(
        data.name || undefined
      );

      if (!data.onboarding_completed) {
        setNeedsOnboarding(true);
      } else {
        setNeedsOnboarding(false);
      }
    }

    setCheckingOnboarding(false);
  };


  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);

    /*
     * Deliberately DO NOT restore the last DB conversation here.
     *
     * A newly opened session should start with the welcome screen.
     */
    setConversationId(null);
    setMessages([]);
    sessionStorage.removeItem(
      ACTIVE_CHAT_KEY
    );
  };


  /* ========================================================================= */
  /*                         LOAD CONVERSATIONS                                 */
  /* ========================================================================= */

  const loadConversations =
    useCallback(async () => {
      if (!user) return;

      const { data, error } =
        await supabase
          .from("conversations")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", {
            ascending: false,
          });

      if (error) {
        console.error(
          "Failed to load conversations:",
          error
        );
        return;
      }

      if (!data) return;

      setConversations(
        data.map((conversation: any) => ({
          ...conversation,
          is_pinned:
            !!conversation.is_pinned,
        }))
      );
    }, [user]);


  useEffect(() => {
    if (!user) return;

    loadConversations();
  }, [user, loadConversations]);


  /* ========================================================================= */
  /*                        RESTORE ACTIVE CHAT                                 */
  /* ========================================================================= */

  useEffect(() => {
    if (!user) return;

    /*
     * IMPORTANT:
     *
     * sessionStorage is intentionally used here.
     *
     * - Route/page navigation inside the same session:
     *     active chat survives.
     *
     * - Fresh browser/app session:
     *     no stored chat → WelcomeScreen.
     *
     * We do NOT use localStorage because that would
     * permanently reopen the previous conversation.
     */

    const storedConversationId =
      sessionStorage.getItem(
        ACTIVE_CHAT_KEY
      );

    if (!storedConversationId) {
      setConversationId(null);
      setMessages([]);
      return;
    }

    setConversationId(
      storedConversationId
    );

    loadMessages(
      storedConversationId
    );
  }, [user]);


  /* ========================================================================= */
  /*                             LOAD MESSAGES                                 */
  /* ========================================================================= */

  const loadMessages = async (
    convId: string
  ) => {
    const { data, error } =
      await supabase
        .from("messages")
        .select("*")
        .eq(
          "conversation_id",
          convId
        )
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      console.error(
        "Failed to load messages:",
        error
      );
      return;
    }

    if (data) {
      setMessages(
        data.map((message: any) => ({
          role:
            message.role as
              | "user"
              | "assistant",
          content: message.content,
        }))
      );
    }
  };


  /* ========================================================================= */
  /*                             AUTO SCROLL                                   */
  /* ========================================================================= */

  useEffect(() => {
    const frame =
      requestAnimationFrame(() => {
        scrollToBottom();
      });

    return () =>
      cancelAnimationFrame(frame);
  }, [messages, scrollToBottom]);


  /* ========================================================================= */
  /*                            CREATE NEW CHAT                                 */
  /* ========================================================================= */

  const createNewChat = async () => {
    if (!user) return;

    /*
     * If the current chat is already a completely
     * empty new chat, don't create another duplicate.
     */
    if (
      conversationId &&
      messages.length === 0
    ) {
      setShowChatList(false);
      return;
    }

    const existingEmpty =
      conversations.find(
        (conversation) =>
          conversation.title ===
            "New Chat" &&
          conversation.id !==
            conversationId
      );

    if (existingEmpty) {
      const { data: existingMessages } =
        await supabase
          .from("messages")
          .select("id")
          .eq(
            "conversation_id",
            existingEmpty.id
          )
          .limit(1);

      if (
        !existingMessages ||
        existingMessages.length === 0
      ) {
        setConversationId(
          existingEmpty.id
        );

        setMessages([]);

        sessionStorage.setItem(
          ACTIVE_CHAT_KEY,
          existingEmpty.id
        );

        setShowChatList(false);

        return;
      }
    }

    const { data: newConversation } =
      await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: "New Chat",
          local_time: getLocalTime(),
          time_of_day: getTimeOfDay(),
        })
        .select()
        .single();

    if (newConversation) {
      setConversationId(
        newConversation.id
      );

      setMessages([]);

      sessionStorage.setItem(
        ACTIVE_CHAT_KEY,
        newConversation.id
      );

      setShowChatList(false);

      await loadConversations();

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  };


  /* ========================================================================= */
  /*                          SWITCH CONVERSATION                              */
  /* ========================================================================= */

  const switchChat = async (
    chatId: string
  ) => {
    setConversationId(chatId);

    sessionStorage.setItem(
      ACTIVE_CHAT_KEY,
      chatId
    );

    setMessages([]);

    await loadMessages(chatId);

    setShowChatList(false);

    setSelectionMode(false);

    setSelectedChats(new Set());
  };


  /* ========================================================================= */
  /*                            SAVE MESSAGE                                    */
  /* ========================================================================= */

  const saveMessage = async (
    role: string,
    content: string
  ) => {
    if (!conversationId || !user) {
      return;
    }

    await supabase
      .from("messages")
      .insert({
        conversation_id:
          conversationId,
        user_id: user.id,
        role,
        content,
        local_time:
          getLocalTime(),
        time_of_day:
          getTimeOfDay(),
      });
  };


  /* ========================================================================= */
  /*                               EDIT                                         */
  /* ========================================================================= */

  const handleEdit = (
    index: number
  ) => {
    setEditingIndex(index);
  };


  const handleSaveEdit = async (
    index: number,
    newContent: string
  ) => {
    if (!newContent.trim()) return;

    const updatedMessages =
      [...messages];

    updatedMessages[index] = {
      ...updatedMessages[index],
      content: newContent,
    };

    setMessages(updatedMessages);

    if (conversationId && user) {
      const messageToUpdate =
        await supabase
          .from("messages")
          .select("id")
          .eq(
            "conversation_id",
            conversationId
          )
          .order("created_at")
          .limit(index + 1);

      if (
        messageToUpdate.data &&
        messageToUpdate.data[index]
      ) {
        await supabase
          .from("messages")
          .update({
            content: newContent,
          })
          .eq(
            "id",
            messageToUpdate
              .data[index].id
          );
      }
    }

    setEditingIndex(null);
  };


  /* ========================================================================= */
  /*                         STOP GENERATION                                    */
  /* ========================================================================= */

  const handleStopGeneration =
    () => {
      if (
        abortControllerRef.current
      ) {
        abortControllerRef.current.abort();

        abortControllerRef.current =
          null;

        setIsLoading(false);
      }
    };


  /* ========================================================================= */
  /*                              REGENERATE                                    */
  /* ========================================================================= */

  const handleRegenerate =
    async () => {
      if (messages.length < 2) {
        return;
      }

      const newMessages =
        messages.slice(0, -1);

      setMessages(newMessages);

      if (conversationId && user) {
        const {
          data: latestMessages,
        } =
          await supabase
            .from("messages")
            .select("id")
            .eq(
              "conversation_id",
              conversationId
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(1);

        if (
          latestMessages &&
          latestMessages[0]
        ) {
          await supabase
            .from("messages")
            .delete()
            .eq(
              "id",
              latestMessages[0].id
            );
        }
      }

      const lastUserMessage =
        newMessages[
          newMessages.length - 1
        ];

      if (
        lastUserMessage &&
        lastUserMessage.role ===
          "user"
      ) {
        await handleSend(
          lastUserMessage.content,
          false,
          true
        );
      }
    };


  /* ========================================================================= */
  /*                            USER CONTEXT                                    */
  /* ========================================================================= */

  const getUserContext =
    async () => {
      if (!user) return "";

      const {
        data: profile,
      } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const {
        data: goals,
      } = await supabase
        .from("goals")
        .select("*")
        .eq(
          "user_id",
          user.id
        );

      const {
        data: activities,
      } = await supabase
        .from("daily_activities")
        .select("*")
        .eq(
          "user_id",
          user.id
        )
        .order("activity_date", {
          ascending: false,
        })
        .limit(30);

      const {
        data: abilities,
      } = await supabase
        .from("abilities_skills")
        .select("*")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

      const {
        data: interests,
      } = await supabase
        .from("interests")
        .select("*")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

      const {
        data: friends,
      } = await supabase
        .from("friends_identities")
        .select("*")
        .eq(
          "user_id",
          user.id
        );

      const {
        data: memories,
      } = await supabase
        .from("ai_memory")
        .select(
          "category, content, sentiment"
        )
        .eq(
          "user_id",
          user.id
        )
        .order("updated_at", {
          ascending: false,
        })
        .limit(40);

      const {
        count: convCount,
      } = await supabase
        .from("conversations")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "user_id",
          user.id
        );

      const {
        count: msgCount,
      } = await supabase
        .from("messages")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "user_id",
          user.id
        );

      let context = "";

      if (profile) {
        context += `
        
User Profile:
- Name: ${profile.name || "Not set"}
- Age: ${profile.age || "Not set"}
- Occupation: ${profile.occupation_or_status || "Not set"}
- Personal Motto: ${profile.personal_motto || "Not set"}`;
      }

      if (goals?.length) {
        context +=
          `\n\nUser Goals:`;

        goals.forEach(
          (goal: any) => {
            context += `
- ${goal.goal_title}: ${
              goal.goal_description ||
              ""
            } (${goal.goal_duration_days}d)`;
          }
        );
      }

      if (abilities) {
        context +=
          `\n\nAbilities:`;

        if (
          abilities
            .technical_skills?.length
        ) {
          context +=
            `\n- Tech: ${abilities.technical_skills.join(", ")}`;
        }

        if (
          abilities
            .soft_skills?.length
        ) {
          context +=
            `\n- Soft: ${abilities.soft_skills.join(", ")}`;
        }

        if (
          abilities
            .languages?.length
        ) {
          context +=
            `\n- Languages: ${abilities.languages.join(", ")}`;
        }

        if (
          abilities
            .strengths?.length
        ) {
          context +=
            `\n- Strengths: ${abilities.strengths.join(", ")}`;
        }

        if (
          abilities
            .weaknesses?.length
        ) {
          context +=
            `\n- Growth: ${abilities.weaknesses.join(", ")}`;
        }
      }

      if (interests) {
        context +=
          `\n\nInterests:`;

        if (
          interests.hobbies?.length
        ) {
          context +=
            `\n- Hobbies: ${interests.hobbies.join(", ")}`;
        }

        if (
          interests.music?.length
        ) {
          context +=
            `\n- Music: ${interests.music.join(", ")}`;
        }
      }

      if (friends?.length) {
        context +=
          `\n\nFriends:`;

        friends.forEach(
          (friend: any) => {
            context += `
- ${friend.friend_name} (${
              friend.relationship ||
              "Friend"
            })`;
          }
        );
      }

      if (activities?.length) {
        context +=
          `\n\nRecent Activities:`;

        activities
          .slice(0, 10)
          .forEach(
            (activity: any) => {
              context += `
- ${activity.activity_date}: Mood: ${
                activity.mood || "?"
              }`;
            }
          );
      }

      if (memories?.length) {
        const grouped: Record<
          string,
          string[]
        > = {};

        for (const memory of memories) {
          const category =
            memory.category ||
            "other";

          if (!grouped[category]) {
            grouped[category] = [];
          }

          grouped[category].push(
            `${memory.content}${
              memory.sentiment ===
              "strong"
                ? " (strongly)"
                : ""
            }`
          );
        }

        context +=
          `\n\nAI Memories (things learned about this user):`;

        for (const [
          category,
          items,
        ] of Object.entries(
          grouped
        )) {
          context +=
            `\n${category}: ${items.join("; ")}`;
        }
      }

      context += `
      
Relationship: ${
        convCount || 0
      } conversations, ${
        msgCount || 0
      } total messages exchanged.`;

      return context;
    };


  /* ========================================================================= */
  /*                           MEMORY EXTRACTION                                */
  /* ========================================================================= */

  const extractMemory =
    async (
      messageContent: string,
      messageId?: string
    ) => {
      try {
        const {
          data: profile,
        } = await supabase
          .from("profiles")
          .select(
            "ai_learning_enabled"
          )
          .eq(
            "id",
            user?.id
          )
          .single();

        if (
          !profile?.ai_learning_enabled
        ) {
          return;
        }

        const {
          data,
          error,
        } =
          await supabase.functions.invoke(
            "extract-memory",
            {
              body: {
                message:
                  messageContent,
                messageId,
              },
            }
          );

        if (error) return;

        if (
          data?.should_save &&
          data.category &&
          data.content
        ) {
          await supabase
            .from("ai_memory")
            .insert({
              user_id: user?.id,
              category:
                data.category,
              content:
                data.content,
              sentiment:
                data.sentiment ||
                "moderate",
              source_message_id:
                messageId ||
                null,
            });
        }
      } catch (error) {
        console.error(
          "Memory extraction failed:",
          error
        );
      }
    };


  /* ========================================================================= */
  /*                              SEND MESSAGE                                 */
  /* ========================================================================= */

  const handleSend = async (
    messageText?: string,
    includeContext = false,
    isRegenerate = false
  ) => {
    const textToSend =
      messageText || input;

    if (
      !textToSend.trim() ||
      isLoading
    ) {
      return;
    }

    if (
      !requireAuth(
        user,
        "chat with the AI",
        () => setShowAuthDialog(true),
        (message) =>
          toast({
            title: message,
          })
      )
    ) {
      return;
    }

    if (!isRegenerate) {
      const userMessage: Message = {
        role: "user",
        content: textToSend,
      };

      setMessages(
        (previous) => [
          ...previous,
          userMessage,
        ]
      );

      await saveMessage(
        "user",
        textToSend
      );

      extractMemory(
        textToSend
      );
    }

    if (!messageText) {
      setInput("");
    }

    setIsLoading(true);

    abortControllerRef.current =
      new AbortController();

    setTimeout(() => {
      scrollToBottom(true);
    }, 0);

    if (textareaRef.current) {
      textareaRef.current.style.height =
        "auto";
    }

    let assistantContent = "";

    let userContext = "";

    if (includeContext) {
      userContext =
        await getUserContext();
    }

    try {
      const messagesToSend =
        isRegenerate
          ? messages
          : [
              ...messages,
              {
                role: "user" as const,
                content:
                  textToSend,
              },
            ];

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (
        !session?.access_token
      ) {
        toast({
          title:
            "Session expired",
          description:
            "Please sign in again.",
          variant:
            "destructive",
        });

        setIsLoading(false);

        return;
      }

      const response =
        await apiStream(
          "/chat",
          {
            method: "POST",
            body: {
              messages:
                messagesToSend,
              userContext,
              userLocalTime:
                getLocalTime(),
              userTimeOfDay:
                getTimeOfDay(),
            },
            signal:
              abortControllerRef.current
                .signal,
          }
        );

      if (!response.ok) {
        if (
          response.status === 429
        ) {
          toast({
            title:
              "Rate limit exceeded",
            variant:
              "destructive",
          });

          setIsLoading(false);

          return;
        }

        if (
          response.status === 402
        ) {
          toast({
            title:
              "Payment required",
            variant:
              "destructive",
          });

          setIsLoading(false);

          return;
        }

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          toast({
            title:
              "Session expired",
            description:
              "Please sign in to continue.",
            variant:
              "destructive",
          });

          setShowAuthDialog(true);

          setIsLoading(false);

          if (!isRegenerate) {
            setMessages(
              (previous) =>
                previous.slice(0, -1)
            );
          }

          return;
        }

        throw new Error(
          "Failed to start stream"
        );
      }

      if (!response.body) {
        throw new Error(
          "No response body"
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let textBuffer = "";

      let streamFinished = false;

      while (!streamFinished) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) break;

        textBuffer += decoder.decode(
          value,
          { stream: true }
        );

        let newlineIndex: number;

        while (
          (newlineIndex =
            textBuffer.indexOf(
              "\n"
            )) !== -1
        ) {
          let line =
            textBuffer.slice(
              0,
              newlineIndex
            );

          textBuffer =
            textBuffer.slice(
              newlineIndex + 1
            );

          if (
            line.endsWith("\r")
          ) {
            line =
              line.slice(0, -1);
          }

          if (
            line.startsWith(":") ||
            line.trim() === ""
          ) {
            continue;
          }

          if (
            !line.startsWith(
              "data: "
            )
          ) {
            continue;
          }

          const jsonString =
            line
              .slice(6)
              .trim();

          if (
            jsonString === "[DONE]"
          ) {
            streamFinished = true;
            break;
          }

          try {
            const parsed =
              JSON.parse(
                jsonString
              );

            const content =
              parsed.choices?.[0]
                ?.delta?.content as
                | string
                | undefined;

            if (content) {
              assistantContent +=
                content;

              setMessages(
                (previous) => {
                  const last =
                    previous[
                      previous.length - 1
                    ];

                  if (
                    last?.role ===
                    "assistant"
                  ) {
                    return previous.map(
                      (
                        message,
                        index
                      ) =>
                        index ===
                        previous.length -
                          1
                          ? {
                              ...message,
                              content:
                                assistantContent,
                            }
                          : message
                    );
                  }

                  return [
                    ...previous,
                    {
                      role:
                        "assistant",
                      content:
                        assistantContent,
                    },
                  ];
                }
              );
            }
          } catch {
            textBuffer =
              line +
              "\n" +
              textBuffer;

            break;
          }
        }
      }

      if (assistantContent) {
        await saveMessage(
          "assistant",
          assistantContent
        );
      }

      const currentConversation =
        conversations.find(
          (conversation) =>
            conversation.id ===
            conversationId
        );

      if (
        conversationId &&
        !isRegenerate &&
        currentConversation &&
        (
          currentConversation.title ===
            "New Chat" ||
          currentConversation.title?.startsWith(
            "Chat "
          )
        )
      ) {
        generateChatTitle(
          conversationId,
          textToSend,
          assistantContent
        );
      }

      await loadConversations();

      setIsLoading(false);

      abortControllerRef.current =
        null;
    } catch (error: any) {
      logError(
        "Chat handleSend",
        error
      );

      if (
        error?.name ===
        "AbortError"
      ) {
        /*
         * Do not remove the user's message
         * when the user intentionally stops
         * generation.
         */
        setIsLoading(false);
        return;
      }

      toast({
        title: "Error",
        description:
          getUserFriendlyError(
            error
          ),
        variant:
          "destructive",
      });

      if (!isRegenerate) {
        setMessages(
          (previous) =>
            previous.slice(0, -1)
        );
      }

      setIsLoading(false);

      abortControllerRef.current =
        null;
    }
  };


  /* ========================================================================= */
  /*                           CHAT TITLE                                      */
  /* ========================================================================= */

  const generateChatTitle =
    async (
      convId: string,
      userMessage: string,
      assistantMessage: string
    ) => {
      try {
        const { data } =
          await supabase.functions.invoke(
            "generate-chat-title",
            {
              body: {
                userMessage,
                assistantMessage,
              },
            }
          );

        if (data?.title) {
          await supabase
            .from("conversations")
            .update({
              title: data.title,
            })
            .eq(
              "id",
              convId
            );

          setConversations(
            (previous) =>
              previous.map(
                (conversation) =>
                  conversation.id ===
                  convId
                    ? {
                        ...conversation,
                        title:
                          data.title,
                      }
                    : conversation
              )
          );
        }
      } catch (error) {
        console.error(
          "Failed to generate chat title:",
          error
        );
      }
    };


  /* ========================================================================= */
  /*                              SUGGESTIONS                                  */
  /* ========================================================================= */

  const handleSuggestion =
    (prompt: string) => {
      handleSend(
        prompt,
        true
      );
    };


  /* ========================================================================= */
  /*                        LONG-PRESS HELPERS                                 */
  /* ========================================================================= */

  const cancelLongPress =
    useCallback(() => {
      if (longPressTimer.current) {
        clearTimeout(
          longPressTimer.current
        );

        longPressTimer.current =
          null;
      }
    }, []);


  const openActionCard = (
    conversation: Conversation
  ) => {
    cancelLongPress();

    longPressTriggered.current =
      true;

    setActionChat(
      conversation
    );

    setShowActionCard(true);
  };


  const startLongPress = (
    conversation: Conversation
  ) => {
    cancelLongPress();

    longPressTriggered.current =
      false;

    longPressTimer.current =
      setTimeout(() => {
        openActionCard(
          conversation
        );
      }, LONG_PRESS_DURATION);
  };


  /* ========================================================================= */
  /*                         PIN / UNPIN                                       */
  /* ========================================================================= */

  const togglePinConversation =
    async (
      conversation: Conversation
    ) => {
      const nextPinned =
        !conversation.is_pinned;

      const { error } =
        await supabase
          .from("conversations")
          .update({
            is_pinned:
              nextPinned,
          })
          .eq(
            "id",
            conversation.id
          );

      if (error) {
        console.error(
          "Failed to pin conversation:",
          error
        );

        toast({
          title:
            "Couldn't update pin",
          variant:
            "destructive",
        });

        return;
      }

      setConversations(
        (previous) =>
          previous.map(
            (item) =>
              item.id ===
              conversation.id
                ? {
                    ...item,
                    is_pinned:
                      nextPinned,
                  }
                : item
          )
      );

      setShowActionCard(false);

      setActionChat(null);
    };


  /* ========================================================================= */
  /*                              DELETE                                       */
  /* ========================================================================= */

  const deleteConversation =
    async (
      chatId: string
    ) => {
      const { error } =
        await supabase
          .from("conversations")
          .delete()
          .eq(
            "id",
            chatId
          );

      if (error) {
        console.error(
          "Failed to delete conversation:",
          error
        );

        toast({
          title:
            "Couldn't delete chat",
          variant:
            "destructive",
        });

        return false;
      }

      if (
        conversationId ===
        chatId
      ) {
        setConversationId(
          null
        );

        setMessages([]);

        sessionStorage.removeItem(
          ACTIVE_CHAT_KEY
        );
      }

      setConversations(
        (previous) =>
          previous.filter(
            (conversation) =>
              conversation.id !==
              chatId
          )
      );

      return true;
    };


  /* ========================================================================= */
  /*                       MULTI-SELECT DELETE                                */
  /* ========================================================================= */

  const deleteSelectedChats =
    async () => {
      const ids =
        Array.from(
          selectedChats
        );

      if (!ids.length) return;

      const { error } =
        await supabase
          .from("conversations")
          .delete()
          .in("id", ids);

      if (error) {
        console.error(
          "Failed to delete selected conversations:",
          error
        );

        toast({
          title:
            "Couldn't delete selected chats",
          variant:
            "destructive",
        });

        return;
      }

      if (
        conversationId &&
        selectedChats.has(
          conversationId
        )
      ) {
        setConversationId(
          null
        );

        setMessages([]);

        sessionStorage.removeItem(
          ACTIVE_CHAT_KEY
        );
      }

      setConversations(
        (previous) =>
          previous.filter(
            (conversation) =>
              !selectedChats.has(
                conversation.id
              )
          )
      );

      setSelectedChats(
        new Set()
      );

      setSelectionMode(
        false
      );

      setShowActionCard(
        false
      );

      setActionChat(
        null
      );
    };


  /* ========================================================================= */
  /*                          RENAME CHAT                                      */
  /* ========================================================================= */

  const beginRename =
    (
      conversation: Conversation
    ) => {
      setRenamingChatId(
        conversation.id
      );

      setRenameValue(
        conversation.title ||
          "New Chat"
      );

      setShowActionCard(
        false
      );

      setActionChat(
        null
      );
    };


  const saveRename = async () => {
    if (!renamingChatId) {
      return;
    }

    const trimmed =
      renameValue.trim();

    if (!trimmed) {
      setRenamingChatId(
        null
      );

      return;
    }

    const { error } =
      await supabase
        .from("conversations")
        .update({
          title: trimmed,
        })
        .eq(
          "id",
          renamingChatId
        );

    if (error) {
      console.error(
        "Failed to rename conversation:",
        error
      );

      toast({
        title:
          "Couldn't rename chat",
        variant:
          "destructive",
      });

      return;
    }

    setConversations(
      (previous) =>
        previous.map(
          (conversation) =>
            conversation.id ===
            renamingChatId
              ? {
                  ...conversation,
                  title:
                    trimmed,
                }
              : conversation
        )
    );

    setRenamingChatId(
      null
    );

    setRenameValue("");
  };


  /* ========================================================================= */
  /*                          SELECTION MODE                                   */
  /* ========================================================================= */

  const enterSelectionMode =
    () => {
      setSelectionMode(
        true
      );

      setSelectedChats(
        new Set()
      );
    };


  const exitSelectionMode =
    () => {
      setSelectionMode(
        false
      );

      setSelectedChats(
        new Set()
      );
    };


  const toggleSelectedChat =
    (chatId: string) => {
      setSelectedChats(
        (previous) => {
          const next =
            new Set(previous);

          if (
            next.has(chatId)
          ) {
            next.delete(
              chatId
            );
          } else {
            next.add(chatId);
          }

          return next;
        }
      );
    };


  /* ========================================================================= */
  /*                         DRAWER TOUCH LOGIC                                */
  /* ========================================================================= */

  const handleDrawerTouchStart =
    (
      event: React.TouchEvent<HTMLDivElement>
    ) => {
      const touch =
        event.touches[0];

      const target =
        event.target as HTMLElement;

      if (
        target.closest(
          "textarea, input, pre, [data-no-swipe]"
        )
      ) {
        dragRef.current =
          null;

        return;
      }

      const startedOpen =
        showChatList;

      /*
       * When closed, only start a swipe from
       * the left 35% of the screen.
       *
       * When open, allow a swipe anywhere.
       */
      if (
        !startedOpen &&
        touch.clientX >
          window.innerWidth *
            0.35
      ) {
        dragRef.current =
          null;

        return;
      }

      dragRef.current = {
        startX:
          touch.clientX,
        startY:
          touch.clientY,
        startedOpen,
        active: true,
        locked: false,
      };
    };


  const handleDrawerTouchMove =
    (
      event: React.TouchEvent<HTMLDivElement>
    ) => {
      const drag =
        dragRef.current;

      if (
        !drag ||
        !drag.active
      ) {
        return;
      }

      const touch =
        event.touches[0];

      const dx =
        touch.clientX -
        drag.startX;

      const dy =
        touch.clientY -
        drag.startY;

      if (!drag.locked) {
        if (
          Math.abs(dx) < 6 &&
          Math.abs(dy) < 6
        ) {
          return;
        }

        if (
          Math.abs(dy) >
          Math.abs(dx)
        ) {
          drag.active =
            false;

          return;
        }

        drag.locked =
          true;
      }

      const base =
        drag.startedOpen
          ? drawerWidth
          : 0;

      const next =
        Math.max(
          0,
          Math.min(
            drawerWidth,
            base + dx
          )
        );

      setDragX(next);
    };


  const handleDrawerTouchEnd =
    () => {
      const drag =
        dragRef.current;

      dragRef.current =
        null;

      if (
        !drag ||
        !drag.locked
      ) {
        setDragX(null);

        return;
      }

      const current =
        dragX ??
        (drag.startedOpen
          ? drawerWidth
          : 0);

      const open =
        current >
        drawerWidth * 0.4;

      setShowChatList(
        open
      );

      if (
        open &&
        !drag.startedOpen
      ) {
        navigator.vibrate?.(10);
      }

      setDragX(null);
    };


  /* ========================================================================= */
  /*                              INPUT EVENTS                                 */
  /* ========================================================================= */

  const handleInputKeyDown =
    (
      event: KeyboardEvent<HTMLTextAreaElement>
    ) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !isLoading
      ) {
        event.preventDefault();

        handleSend();
      }
    };


  /* ========================================================================= */
  /*                             DERIVED STATE                                 */
  /* ========================================================================= */

  const isGuest =
    !user;

  const currentTitle =
    conversations.find(
      (conversation) =>
        conversation.id ===
        conversationId
    )?.title ||
    "New Chat";


  const filteredConversations =
    chatSearch.trim()
      ? conversations.filter(
          (conversation) =>
            (
              conversation.title ||
              ""
            )
              .toLowerCase()
              .includes(
                chatSearch
                  .toLowerCase()
              )
        )
      : conversations;


  const conversationGroups =
    groupConversations(
      filteredConversations
    );


  /* ========================================================================= */
  /*                         LOADING / ONBOARDING                              */
  /* ========================================================================= */

  if (
    user &&
    checkingOnboarding
  ) {
    return (
      <div className="flex h-screen items-center justify-center particle-bg">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary/20 animate-ping" />

            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60">
              <Sparkles className="w-8 h-8 text-primary-foreground animate-pulse" />
            </div>
          </div>

          <p className="text-muted-foreground animate-pulse">
            Initializing...
          </p>
        </div>
      </div>
    );
  }


  if (
    user &&
    needsOnboarding
  ) {
    return (
      <Onboarding
        userId={user.id}
        onComplete={
          handleOnboardingComplete
        }
      />
    );
  }


  /* ========================================================================= */
  /*                                  RENDER                                   */
  /* ========================================================================= */

  return (
    <div
      className="
        flex
        h-[calc(100dvh-4rem)]
        md:h-[100dvh]
        min-h-0
        w-full
        bg-background
        overflow-hidden
      "
      onTouchStart={
        handleDrawerTouchStart
      }
      onTouchMove={
        handleDrawerTouchMove
      }
      onTouchEnd={
        handleDrawerTouchEnd
      }
      onTouchCancel={
        handleDrawerTouchEnd
      }
    >

      {/* =================================================================== */}
      {/* AUTH DIALOG                                                         */}
      {/* =================================================================== */}

      {isGuest &&
        showAuthDialog && (
          <div
            className="
              fixed
              inset-0
              z-[100]
              bg-black/50
              flex
              items-center
              justify-center
              p-4
            "
            onClick={() =>
              setShowAuthDialog(
                false
              )
            }
          >
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <Auth />
            </div>
          </div>
        )}


      {/* =================================================================== */}
      {/* CHAT HISTORY DRAWER                                                 */}
      {/* =================================================================== */}

      {(() => {
        const offset =
          dragX ??
          (showChatList
            ? drawerWidth
            : 0);

        const progress =
          drawerWidth > 0
            ? offset /
              drawerWidth
            : 0;

        const dragging =
          dragX !== null;

        return (
          <>
            {/* Backdrop */}

            <div
              onClick={() => {
                setShowChatList(
                  false
                );

                exitSelectionMode();
              }}
              aria-hidden={
                offset <= 0
              }
              style={{
                opacity:
                  progress * 0.5,
                pointerEvents:
                  offset > 8
                    ? "auto"
                    : "none",
              }}
              className={`
                fixed
                inset-0
                z-40
                bg-black
                ${
                  dragging
                    ? ""
                    : "transition-opacity duration-150"
                }
              `}
            />


            {/* Drawer */}

            <aside
              role="dialog"
              aria-label="Chat history"
              style={{
                width:
                  drawerWidth,
                transform:
                  `translate3d(${
                    offset -
                    drawerWidth
                  }px, 0, 0)`,
                transition:
                  dragging
                    ? "none"
                    : "transform 150ms ease-out",
              }}
              className="
                fixed
                top-0
                bottom-0
                left-0
                z-50
                bg-background
                border-r
                border-border
                shadow-2xl
                flex
                flex-col
                overflow-hidden
              "
            >

              {/* --------------------------------------------------------- */}
              {/* Drawer Header                                              */}
              {/* --------------------------------------------------------- */}

              <div
                className="
                  shrink-0
                  h-14
                  px-3
                  flex
                  items-center
                  justify-between
                  border-b
                "
              >

                {selectionMode ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={
                        exitSelectionMode
                      }
                    >
                      <X className="h-5 w-5" />
                    </Button>

                    <span className="text-sm font-medium">
                      {selectedChats.size} selected
                    </span>

                    {selectedChats.size >
                    0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="
                          h-9
                          w-9
                          text-destructive
                        "
                        onClick={() => {
                          setActionChat(
                            null
                          );

                          setShowActionCard(
                            true
                          );
                        }}
                        aria-label="Actions for selected chats"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    ) : (
                      <div className="w-9" />
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-sm font-semibold">
                      Chat history
                    </h2>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        setShowChatList(
                          false
                        )
                      }
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </>
                )}

              </div>


              {/* --------------------------------------------------------- */}
              {/* New Chat                                                   */}
              {/* --------------------------------------------------------- */}

              {!selectionMode && (
                <div className="shrink-0 p-3">

                  <Button
                    onClick={
                      createNewChat
                    }
                    className="
                      w-full
                      gap-2
                    "
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    New Chat
                  </Button>

                </div>
              )}


              {/* --------------------------------------------------------- */}
              {/* Search                                                    */}
              {/* --------------------------------------------------------- */}

              {!selectionMode && (
                <div
                  className="
                    shrink-0
                    px-3
                    pb-3
                  "
                >
                  <div className="relative">

                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />

                    <input
                      value={
                        chatSearch
                      }
                      onChange={(event) =>
                        setChatSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search chats..."
                      data-no-swipe
                      className="
                        w-full
                        pl-9
                        pr-3
                        py-2.5
                        text-sm
                        rounded-xl
                        bg-muted/50
                        border
                        border-border/50
                        focus:outline-none
                        focus:border-primary/50
                        transition-colors
                      "
                    />

                  </div>
                </div>
              )}


              {/* --------------------------------------------------------- */}
              {/* Conversations                                             */}
              {/* --------------------------------------------------------- */}

              <ScrollArea className="flex-1 min-h-0">

                <div className="p-2 pb-4 space-y-4">

                  {conversationGroups.map(
                    (group) => (
                      <section
                        key={
                          group.label
                        }
                      >

                        <p className="
                          px-3
                          py-1.5
                          text-xs
                          font-semibold
                          text-muted-foreground
                        ">
                          {group.label}
                        </p>


                        <div className="space-y-1">

                          {group.items.map(
                            (
                              conversation
                            ) => {
                              const selected =
                                selectedChats.has(
                                  conversation.id
                                );

                              const isRenaming =
                                renamingChatId ===
                                conversation.id;

                              return (
                                <div
                                  key={
                                    conversation.id
                                  }
                                  data-no-swipe
                                  className="
                                    relative
                                    rounded-xl
                                  "
                                  onPointerDown={() => {
                                    if (
                                      selectionMode
                                    ) {
                                      return;
                                    }

                                    startLongPress(
                                      conversation
                                    );
                                  }}
                                  onPointerUp={() => {
                                    const wasLongPressed =
                                      longPressTriggered.current;

                                    cancelLongPress();

                                    if (
                                      !wasLongPressed &&
                                      !selectionMode
                                    ) {
                                      switchChat(
                                        conversation.id
                                      );
                                    }

                                    longPressTriggered.current =
                                      false;
                                  }}
                                  onPointerLeave={() => {
                                    cancelLongPress();
                                  }}
                                  onPointerCancel={() => {
                                    cancelLongPress();
                                    longPressTriggered.current =
                                      false;
                                  }}
                                  onContextMenu={(
                                    event
                                  ) => {
                                    event.preventDefault();

                                    if (
                                      selectionMode
                                    ) {
                                      return;
                                    }

                                    openActionCard(
                                      conversation
                                    );
                                  }}
                                >

                                  {isRenaming ? (
                                    <div
                                      className="
                                        flex
                                        items-center
                                        gap-2
                                        p-2
                                        rounded-xl
                                        bg-muted
                                      "
                                    >
                                      <input
                                        autoFocus
                                        value={
                                          renameValue
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setRenameValue(
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        onKeyDown={(
                                          event
                                        ) => {
                                          if (
                                            event.key ===
                                            "Enter"
                                          ) {
                                            saveRename();
                                          }

                                          if (
                                            event.key ===
                                            "Escape"
                                          ) {
                                            setRenamingChatId(
                                              null
                                            );

                                            setRenameValue(
                                              ""
                                            );
                                          }
                                        }}
                                        className="
                                          min-w-0
                                          flex-1
                                          h-9
                                          rounded-lg
                                          border
                                          bg-background
                                          px-2
                                          text-sm
                                          outline-none
                                        "
                                        data-no-swipe
                                      />

                                      <Button
                                        size="icon"
                                        className="h-9 w-9 shrink-0"
                                        onClick={
                                          saveRename
                                        }
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className={`
                                        w-full
                                        flex
                                        items-center
                                        gap-2
                                        px-3
                                        py-3
                                        rounded-xl
                                        text-left
                                        transition-colors
                                        select-none
                                        ${
                                          selected
                                            ? "bg-primary/10 text-primary"
                                            : conversationId ===
                                                conversation.id
                                              ? "bg-muted"
                                              : "hover:bg-muted/60"
                                        }
                                      `}
                                      onClick={() => {
                                        if (
                                          selectionMode
                                        ) {
                                          toggleSelectedChat(
                                            conversation.id
                                          );
                                        }
                                      }}
                                      onPointerDown={(
                                        event
                                      ) => {
                                        /*
                                         * In selection mode, don't
                                         * start a long press.
                                         */
                                        if (
                                          selectionMode
                                        ) {
                                          return;
                                        }

                                        event.stopPropagation();

                                        startLongPress(
                                          conversation
                                        );
                                      }}
                                    >

                                      {selectionMode && (
                                        <span
                                          className={`
                                            h-5
                                            w-5
                                            shrink-0
                                            rounded-md
                                            border
                                            flex
                                            items-center
                                            justify-center
                                            ${
                                              selected
                                                ? "bg-primary border-primary text-primary-foreground"
                                                : "border-border"
                                            }
                                          `}
                                        >
                                          {selected && (
                                            <Check className="h-3.5 w-3.5" />
                                          )}
                                        </span>
                                      )}


                                      <span className="min-w-0 flex-1">

                                        <span className="
                                          block
                                          truncate
                                          text-sm
                                        ">
                                          {conversation.title ||
                                            "New Chat"}
                                        </span>

                                      </span>


                                      {conversation.is_pinned &&
                                        !selectionMode && (
                                          <Pin
                                            className="
                                              h-3.5
                                              w-3.5
                                              shrink-0
                                              text-muted-foreground
                                            "
                                          />
                                        )}

                                    </button>
                                  )}

                                </div>
                              );
                            }
                          )}

                        </div>

                      </section>
                    )
                  )}


                  {conversationGroups.length ===
                    0 && (
                    <p className="
                      px-3
                      py-10
                      text-center
                      text-xs
                      text-muted-foreground
                    ">
                      No chats yet.
                    </p>
                  )}

                </div>

              </ScrollArea>


              {/* --------------------------------------------------------- */}
              {/* Selection Mode Entry                                      */}
              {/* --------------------------------------------------------- */}

              {!selectionMode &&
                conversations.length >
                  0 && (
                  <div className="
                    shrink-0
                    border-t
                    p-3
                  ">
                    <Button
                      variant="ghost"
                      className="
                        w-full
                        justify-start
                        text-muted-foreground
                      "
                      onClick={
                        enterSelectionMode
                      }
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Select chats
                    </Button>
                  </div>
                )}

            </aside>
          </>
        );
      })()}


      {/* =================================================================== */}
      {/* MAIN CHAT                                                           */}
      {/* =================================================================== */}

      <div
        className="
          flex
          flex-1
          min-w-0
          min-h-0
          flex-col
          overflow-hidden
        "
      >

        {/* ----------------------------------------------------------------- */}
        {/* Guest auth prompt                                                */}
        {/* ----------------------------------------------------------------- */}

        {isGuest && (
          <div className="
            shrink-0
            px-4
            py-2
            bg-primary/5
            border-b
            border-border/50
            flex
            items-center
            justify-between
            gap-3
          ">

            <span className="
              text-xs
              text-muted-foreground
            ">
              Sign in to save your chats
            </span>

            <div className="
              flex
              gap-1.5
              shrink-0
            ">

              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() =>
                  setShowAuthDialog(
                    true
                  )
                }
              >
                Sign In
              </Button>

              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  setShowAuthDialog(
                    true
                  )
                }
              >
                Sign Up
              </Button>

            </div>

          </div>
        )}


        {/* ----------------------------------------------------------------- */}
        {/* Chat header                                                       */}
        {/* ----------------------------------------------------------------- */}

        <header
          className="
            shrink-0
            h-14
            border-b
            px-3
            sm:px-4
            flex
            items-center
            justify-between
            bg-background/95
            backdrop-blur
            z-20
          "
        >

          <div className="
            flex
            items-center
            gap-2
            min-w-0
          ">

            <Button
              variant="ghost"
              size="icon"
              className="
                h-9
                w-9
                shrink-0
                tap-effect
              "
              onClick={() =>
                setShowChatList(
                  true
                )
              }
              aria-label="Open chat history"
            >
              <Menu className="h-5 w-5" />
            </Button>


            <h1 className="
              text-sm
              font-semibold
              text-foreground
              truncate
              max-w-[55vw]
              sm:max-w-xs
            ">
              {currentTitle}
            </h1>

          </div>


          <Button
            variant="ghost"
            size="icon"
            className="
              h-9
              w-9
              shrink-0
              tap-effect
            "
            onClick={
              createNewChat
            }
            aria-label="New chat"
          >
            <Edit3 className="h-4 w-4" />
          </Button>

        </header>


        {/* ----------------------------------------------------------------- */}
        {/* AI provider                                                       */}
        {/* ----------------------------------------------------------------- */}

        {!isGuest && (
          <div className="shrink-0">
            <AIProviderBanner />
          </div>
        )}


        {/* ----------------------------------------------------------------- */}
        {/* MESSAGE AREA                                                      */}
        {/* ----------------------------------------------------------------- */}

        <div
          className="
            flex-1
            min-h-0
            overflow-hidden
          "
        >

          <ScrollArea
            className="
              h-full
              w-full
            "
          >

            {messages.length === 0 ? (
              <div className="
                w-full
                max-w-3xl
                mx-auto
                px-4
                py-5
                sm:px-6
                sm:py-8
              ">
                <WelcomeScreen
                  userName={
                    userName
                  }
                  onSuggestion={
                    handleSuggestion
                  }
                />
              </div>
            ) : (
              <div className="
                w-full
                max-w-3xl
                mx-auto
                px-4
                py-5
                sm:px-6
                sm:py-8
              ">

                <div className="space-y-5">

                  {messages.map(
                    (
                      message,
                      index
                    ) => (
                      <ChatMessage
                        key={`${index}-${message.role}`}
                        content={
                          message.content
                        }
                        role={
                          message.role
                        }
                        isEditing={
                          editingIndex ===
                          index
                        }
                        onEdit={
                          message.role ===
                          "user"
                            ? () =>
                                handleEdit(
                                  index
                                )
                            : undefined
                        }
                        onSaveEdit={(
                          content
                        ) =>
                          handleSaveEdit(
                            index,
                            content
                          )
                        }
                        onCancelEdit={() =>
                          setEditingIndex(
                            null
                          )
                        }
                        onRegenerate={
                          message.role ===
                            "assistant" &&
                          index ===
                            messages.length -
                              1 &&
                          !isLoading
                            ? handleRegenerate
                            : undefined
                        }
                        isLastAssistant={
                          message.role ===
                            "assistant" &&
                          index ===
                            messages.length -
                              1
                        }
                        conversationId={
                          conversationId
                        }
                      />
                    )
                  )}


                  {isLoading &&
                    !messages.find(
                      (
                        message
                      ) =>
                        message.role ===
                          "assistant" &&
                        message.content ===
                          ""
                    ) && (
                      <TypingIndicator />
                    )}


                  <div
                    ref={
                      messagesEndRef
                    }
                  />

                </div>

              </div>
            )}

          </ScrollArea>

        </div>


        {/* ----------------------------------------------------------------- */}
        {/* COMPOSER                                                          */}
        {/* ----------------------------------------------------------------- */}

        <div
          className="
            shrink-0
            w-full
            border-t
            bg-background
            px-3
            pt-2
            pb-[max(6px,env(safe-area-inset-bottom))]
            sm:px-4
            sm:pb-4
          "
        >

          <div className="
            mx-auto
            max-w-3xl
          ">

            <div className="
              flex
              items-end
              gap-2
              bg-background
              border
              border-border/60
              rounded-[24px]
              px-3
              py-1.5
              sm:py-2
              shadow-sm
              focus-within:border-primary/50
              transition-colors
            ">

              <textarea
                ref={
                  textareaRef
                }
                value={input}
                onChange={(
                  event
                ) => {
                  setInput(
                    event.target.value
                  );

                  adjustTextarea();
                }}
                onFocus={() => {
                  /*
                   * No height-changing class is added here.
                   *
                   * That was one of the causes of the mobile
                   * layout jump in the original implementation.
                   */
                }}
                onKeyDown={
                  handleInputKeyDown
                }
                placeholder="Message StudyTime AI..."
                rows={1}
                disabled={
                  isLoading
                }
                className="
                  flex-1
                  min-w-0
                  min-h-[40px]
                  max-h-40
                  bg-transparent
                  resize-none
                  text-sm
                  sm:text-base
                  leading-6
                  text-foreground
                  placeholder:text-muted-foreground
                  focus:outline-none
                  py-1.5
                  sm:py-2
                "
              />


              {isLoading ? (
                <Button
                  onClick={
                    handleStopGeneration
                  }
                  size="icon"
                  variant="ghost"
                  className="
                    h-9
                    w-9
                    shrink-0
                    rounded-full
                    tap-effect
                  "
                  aria-label="Stop generation"
                >
                  <StopCircle className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    handleSend()
                  }
                  size="icon"
                  className="
                    h-9
                    w-9
                    sm:h-10
                    sm:w-10
                    shrink-0
                    rounded-full
                    tap-effect
                  "
                  disabled={
                    !input.trim()
                  }
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}

            </div>


            <p className="
              text-center
              text-[10px]
              text-muted-foreground
              mt-1
              sm:mt-1.5
            ">
              Enter to send · Shift+Enter for new line
            </p>

          </div>

        </div>

      </div>


      {/* =================================================================== */}
      {/* ACTION CARD                                                         */}
      {/* =================================================================== */}

      {showActionCard && (
        <div
          className="
            fixed
            inset-0
            z-[120]
            flex
            items-end
            justify-center
            p-3
            sm:items-center
          "
        >

          {/* Card backdrop */}

          <button
            type="button"
            aria-label="Close chat actions"
            className="
              absolute
              inset-0
              border-0
              bg-black/40
              backdrop-blur-[2px]
            "
            onClick={() => {
              setShowActionCard(
                false
              );

              setActionChat(
                null
              );
            }}
          />


          {/* Action card */}

          <div
            className="
              relative
              w-full
              max-w-sm
              rounded-2xl
              border
              bg-background
              shadow-2xl
              overflow-hidden
              animate-in
              slide-in-from-bottom-2
              duration-150
            "
          >

            {/* ------------------------------------------------------------ */}
            {/* Multi-select actions                                         */}
            {/* ------------------------------------------------------------ */}

            {selectionMode &&
            selectedChats.size >
              0 ? (
              <>
                <div className="
                  px-4
                  py-3
                  border-b
                ">
                  <p className="text-sm font-semibold">
                    {selectedChats.size} chats selected
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Choose an action
                  </p>
                </div>


                <div className="p-2">

                  <button
                    type="button"
                    className="
                      w-full
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-3
                      text-left
                      text-destructive
                      hover:bg-destructive/10
                    "
                    onClick={
                      deleteSelectedChats
                    }
                  >
                    <Trash2 className="h-5 w-5" />

                    <span className="text-sm font-medium">
                      Delete
                    </span>
                  </button>

                </div>
              </>
            ) : actionChat ? (
              <>
                {/* -------------------------------------------------------- */}
                {/* Single chat actions                                      */}
                {/* -------------------------------------------------------- */}

                <div className="
                  px-4
                  py-3
                  border-b
                ">

                  <p className="
                    text-sm
                    font-semibold
                    truncate
                  ">
                    {actionChat.title ||
                      "New Chat"}
                  </p>

                  <p className="
                    text-xs
                    text-muted-foreground
                    mt-1
                  ">
                    Chat actions
                  </p>

                </div>


                <div className="p-2">

                  {/* Pin */}

                  <button
                    type="button"
                    className="
                      w-full
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-3
                      text-left
                      hover:bg-muted
                    "
                    onClick={() =>
                      togglePinConversation(
                        actionChat
                      )
                    }
                  >

                    {actionChat.is_pinned ? (
                      <PinOff className="h-5 w-5" />
                    ) : (
                      <Pin className="h-5 w-5" />
                    )}

                    <span className="text-sm">
                      {actionChat.is_pinned
                        ? "Unpin"
                        : "Pin"}
                    </span>

                  </button>


                  {/* Rename */}

                  <button
                    type="button"
                    className="
                      w-full
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-3
                      text-left
                      hover:bg-muted
                    "
                    onClick={() =>
                      beginRename(
                        actionChat
                      )
                    }
                  >

                    <Edit3 className="h-5 w-5" />

                    <span className="text-sm">
                      Rename
                    </span>

                  </button>


                  {/* Delete */}

                  <button
                    type="button"
                    className="
                      w-full
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-3
                      text-left
                      text-destructive
                      hover:bg-destructive/10
                    "
                    onClick={async () => {
                      const deleted =
                        await deleteConversation(
                          actionChat.id
                        );

                      if (
                        deleted
                      ) {
                        setShowActionCard(
                          false
                        );

                        setActionChat(
                          null
                        );
                      }
                    }}
                  >

                    <Trash2 className="h-5 w-5" />

                    <span className="text-sm">
                      Delete
                    </span>

                  </button>

                </div>
              </>
            ) : null}

          </div>

        </div>
      )}

    </div>
  );
};

export default Index;