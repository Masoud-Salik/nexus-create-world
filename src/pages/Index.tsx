import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Menu,
  Pencil,
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Check,
  X,
  MoreHorizontal,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { ChatMessage } from "@/components/ChatMessage";
import { TypingIndicator } from "@/components/TypingIndicator";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { AIProviderBanner } from "@/components/chat/AIProviderBanner";

import { useAuth } from "@/hooks/useAuth";

import {
  format,
  isToday,
  isYesterday,
  isThisWeek,
} from "date-fns";


/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string | null;
  pinned?: boolean;
};


/* -------------------------------------------------------------------------- */
/*                              CONSTANTS                                     */
/* -------------------------------------------------------------------------- */

const CHAT_URL = "/functions/v1/chat";

const LONG_PRESS_DURATION = 600;

const ACTIVE_CHAT_KEY = "studytime-active-chat";


/* -------------------------------------------------------------------------- */
/*                           CONVERSATION GROUPING                            */
/* -------------------------------------------------------------------------- */

function groupConversations(conversations: Conversation[]) {
  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Earlier: [],
  };

  conversations.forEach((conversation) => {
    const date = new Date(
      conversation.updated_at || conversation.created_at
    );

    if (isToday(date)) {
      groups.Today.push(conversation);
    } else if (isYesterday(date)) {
      groups.Yesterday.push(conversation);
    } else if (isThisWeek(date)) {
      groups["This week"].push(conversation);
    } else {
      groups.Earlier.push(conversation);
    }
  });

  return groups;
}


/* -------------------------------------------------------------------------- */
/*                                  PAGE                                      */
/* -------------------------------------------------------------------------- */

export default function Index() {
  const { user } = useAuth();

  /* ------------------------------- Chat state ---------------------------- */

  const [conversationId, setConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(false);

  const [userName, setUserName] = useState("");

  /* ---------------------------- Conversation state ---------------------- */

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [showChatList, setShowChatList] = useState(false);

  const [chatSearch, setChatSearch] = useState("");

  /* ----------------------------- Selection state ------------------------- */

  const [selectionMode, setSelectionMode] = useState(false);

  const [selectedChats, setSelectedChats] = useState<Set<string>>(
    new Set()
  );

  /* ----------------------------- Action card ----------------------------- */

  const [actionChat, setActionChat] =
    useState<Conversation | null>(null);

  const [showActionCard, setShowActionCard] = useState(false);

  /* ------------------------------ Rename --------------------------------- */

  const [renamingChatId, setRenamingChatId] =
    useState<string | null>(null);

  const [renameValue, setRenameValue] = useState("");

  /* ------------------------------- Refs ---------------------------------- */

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const longPressTriggered = useRef(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);


  /* ------------------------------------------------------------------------ */
  /*                              LOAD USER                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!user) return;

    const loadUser = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (data?.full_name) {
        setUserName(data.full_name.split(" ")[0]);
      }
    };

    loadUser();
  }, [user]);


  /* ------------------------------------------------------------------------ */
  /*                          LOAD CONVERSATIONS                              */
  /* ------------------------------------------------------------------------ */

  const loadConversations = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to load conversations:", error);
      return;
    }

    setConversations((data || []) as Conversation[]);
  }, [user]);


  useEffect(() => {
    loadConversations();
  }, [loadConversations]);


  /* ------------------------------------------------------------------------ */
  /*                      RESTORE CURRENT CHAT                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!user) return;

    /*
     * sessionStorage is intentional.
     *
     * Route/page navigation:
     *     sessionStorage survives → restore last chat.
     *
     * New browser/app session:
     *     sessionStorage is normally empty → show WelcomeScreen.
     */

    const storedConversationId =
      sessionStorage.getItem(ACTIVE_CHAT_KEY);

    if (!storedConversationId) {
      setConversationId(null);
      setMessages([]);
      return;
    }

    setConversationId(storedConversationId);

    loadMessages(storedConversationId);
  }, [user]);


  /* ------------------------------------------------------------------------ */
  /*                              LOAD MESSAGES                               */
  /* ------------------------------------------------------------------------ */

  const loadMessages = async (id: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load messages:", error);
      return;
    }

    setMessages((data || []) as Message[]);
  };


  /* ------------------------------------------------------------------------ */
  /*                            AUTO SCROLL                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, [messages, loading]);


  /* ------------------------------------------------------------------------ */
  /*                         SELECT CONVERSATION                              */
  /* ------------------------------------------------------------------------ */

  const openConversation = async (id: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    setConversationId(id);

    sessionStorage.setItem(ACTIVE_CHAT_KEY, id);

    await loadMessages(id);

    setShowChatList(false);
    setSelectionMode(false);
    setSelectedChats(new Set());
  };


  /* ------------------------------------------------------------------------ */
  /*                              NEW CHAT                                    */
  /* ------------------------------------------------------------------------ */

  const startNewChat = () => {
    setConversationId(null);

    setMessages([]);

    sessionStorage.removeItem(ACTIVE_CHAT_KEY);

    setShowChatList(false);

    setSelectionMode(false);

    setSelectedChats(new Set());

    textareaRef.current?.focus();
  };


  /* ------------------------------------------------------------------------ */
  /*                         LONG PRESS HANDLING                              */
  /* ------------------------------------------------------------------------ */

  const startLongPress = (conversation: Conversation) => {
    longPressTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;

      setActionChat(conversation);

      setShowActionCard(true);
    }, LONG_PRESS_DURATION);
  };


  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };


  /* ------------------------------------------------------------------------ */
  /*                           MULTI SELECT                                   */
  /* ------------------------------------------------------------------------ */

  const toggleSelectedChat = (id: string) => {
    setSelectedChats((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };


  const enterSelectionMode = () => {
    setSelectionMode(true);
    setShowActionCard(false);
    setActionChat(null);
  };


  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedChats(new Set());
  };


  /* ------------------------------------------------------------------------ */
  /*                                DELETE                                    */
  /* ------------------------------------------------------------------------ */

  const deleteConversation = async (id: string) => {
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete conversation:", error);
      return;
    }

    if (conversationId === id) {
      startNewChat();
    }

    setConversations((previous) =>
      previous.filter((conversation) => conversation.id !== id)
    );
  };


  const deleteSelectedChats = async () => {
    const ids = Array.from(selectedChats);

    if (!ids.length) return;

    const { error } = await supabase
      .from("conversations")
      .delete()
      .in("id", ids);

    if (error) {
      console.error("Failed to delete conversations:", error);
      return;
    }

    if (
      conversationId &&
      selectedChats.has(conversationId)
    ) {
      startNewChat();
    }

    setConversations((previous) =>
      previous.filter(
        (conversation) => !selectedChats.has(conversation.id)
      )
    );

    exitSelectionMode();
  };


  /* ------------------------------------------------------------------------ */
  /*                                  PIN                                     */
  /* ------------------------------------------------------------------------ */

  const togglePinConversation = async (
    conversation: Conversation
  ) => {
    const nextPinned = !conversation.pinned;

    const { error } = await supabase
      .from("conversations")
      .update({
        pinned: nextPinned,
      })
      .eq("id", conversation.id);

    if (error) {
      console.error("Failed to pin conversation:", error);
      return;
    }

    setConversations((previous) =>
      previous.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              pinned: nextPinned,
            }
          : item
      )
    );

    setShowActionCard(false);
    setActionChat(null);
  };


  /* ------------------------------------------------------------------------ */
  /*                                RENAME                                    */
  /* ------------------------------------------------------------------------ */

  const beginRename = (conversation: Conversation) => {
    setRenamingChatId(conversation.id);

    setRenameValue(conversation.title || "New chat");

    setShowActionCard(false);

    setActionChat(null);
  };


  const saveRename = async () => {
    if (!renamingChatId) return;

    const trimmed = renameValue.trim();

    if (!trimmed) {
      setRenamingChatId(null);
      return;
    }

    const { error } = await supabase
      .from("conversations")
      .update({
        title: trimmed,
      })
      .eq("id", renamingChatId);

    if (error) {
      console.error("Failed to rename conversation:", error);
      return;
    }

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === renamingChatId
          ? {
              ...conversation,
              title: trimmed,
            }
          : conversation
      )
    );

    setRenamingChatId(null);
    setRenameValue("");
  };


  /* ------------------------------------------------------------------------ */
  /*                              SEND MESSAGE                                */
  /* ------------------------------------------------------------------------ */

  const sendMessage = async () => {
    const trimmed = input.trim();

    if (!trimmed || loading) return;

    setInput("");

    setLoading(true);

    try {
      let activeConversationId = conversationId;

      /*
       * Create conversation when this is the first message.
       */

      if (!activeConversationId) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({
            user_id: user?.id,
            title:
              trimmed.length > 40
                ? `${trimmed.slice(0, 40)}...`
                : trimmed,
          })
          .select()
          .single();

        if (error || !data) {
          throw error || new Error("Conversation creation failed");
        }

        activeConversationId = data.id;

        setConversationId(activeConversationId);

        sessionStorage.setItem(
          ACTIVE_CHAT_KEY,
          activeConversationId
        );
      }

      const userMessage: Message = {
        role: "user",
        content: trimmed,
      };

      setMessages((previous) => [
        ...previous,
        userMessage,
      ]);

      await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        role: "user",
        content: trimmed,
      });

      /*
       * Send to AI backend.
       */

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          messages: [
            ...messages,
            userMessage,
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("AI request failed");
      }

      const result = await response.json();

      const assistantContent =
        result?.message ||
        result?.content ||
        result?.response ||
        "";

      if (!assistantContent) {
        throw new Error("AI returned an empty response");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: assistantContent,
      };

      setMessages((previous) => [
        ...previous,
        assistantMessage,
      ]);

      await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        role: "assistant",
        content: assistantContent,
      });

      await loadConversations();

    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setLoading(false);

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  };


  /* ------------------------------------------------------------------------ */
  /*                             KEYBOARD                                     */
  /* ------------------------------------------------------------------------ */

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  };


  /* ------------------------------------------------------------------------ */
  /*                         FILTER CONVERSATIONS                             */
  /* ------------------------------------------------------------------------ */

  const filteredConversations = useMemo(() => {
    const search = chatSearch.trim().toLowerCase();

    if (!search) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversation.title
        ?.toLowerCase()
        .includes(search)
    );
  }, [conversations, chatSearch]);


  const groupedConversations =
    groupConversations(filteredConversations);


  /* ------------------------------------------------------------------------ */
  /*                              RENDER                                      */
  /* ------------------------------------------------------------------------ */

  return (
    <div
      className="
        fixed
        inset-0
        flex
        flex-col
        bg-background
        overflow-hidden
      "
    >

      {/* ================================================================== */}
      {/* CHAT HEADER                                                        */}
      {/* ================================================================== */}

      <header
        className="
          shrink-0
          h-14
          border-b
          bg-background/95
          backdrop-blur
          flex
          items-center
          justify-between
          px-3
          z-20
        "
      >

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setShowChatList(true)}
          aria-label="Open chat history"
        >
          <Menu className="h-5 w-5" />
        </Button>


        <div
          className="
            min-w-0
            flex-1
            text-center
            px-3
          "
        >
          <div className="truncate text-sm font-medium">
            {conversationId
              ? conversations.find(
                  (conversation) =>
                    conversation.id === conversationId
                )?.title || "StudyTime AI"
              : "StudyTime AI"}
          </div>
        </div>


        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={startNewChat}
          aria-label="New chat"
        >
          <Pencil className="h-5 w-5" />
        </Button>

      </header>


      {/* ================================================================== */}
      {/* MAIN CHAT AREA                                                     */}
      {/* ================================================================== */}

      <main
        className="
          flex-1
          min-h-0
          flex
          flex-col
          overflow-hidden
        "
      >

        {/* -------------------------------------------------------------- */}
        {/* AI PROVIDER BANNER                                              */}
        {/* -------------------------------------------------------------- */}

        <div className="shrink-0">
          <AIProviderBanner />
        </div>


        {/* -------------------------------------------------------------- */}
        {/* MESSAGES                                                        */}
        {/* -------------------------------------------------------------- */}

        <ScrollArea
          className="
            flex-1
            min-h-0
            w-full
          "
        >

          <div
            className="
              w-full
              max-w-3xl
              mx-auto
              px-4
              py-5
              md:px-6
              md:py-8
            "
          >

            {messages.length === 0 ? (

              <WelcomeScreen
                userName={userName}
                onSuggestion={(suggestion: string) => {
                  setInput(suggestion);

                  requestAnimationFrame(() => {
                    textareaRef.current?.focus();
                  });
                }}
              />

            ) : (

              <div className="space-y-5">

                {messages.map(
                  (message, index) => (
                    <ChatMessage
                      key={`${index}-${message.role}`}
                      role={message.role}
                      content={message.content}
                      conversationId={conversationId}
                      isLastAssistant={
                        message.role === "assistant" &&
                        index === messages.length - 1
                      }
                    />
                  )
                )}

                {loading && (
                  <TypingIndicator />
                )}

                <div ref={messagesEndRef} />

              </div>

            )}

          </div>

        </ScrollArea>


        {/* -------------------------------------------------------------- */}
        {/* MESSAGE COMPOSER                                                */}
        {/* -------------------------------------------------------------- */}

        <div
          className="
            shrink-0
            w-full
            border-t
            bg-background
            px-3
            pt-2
            pb-[max(8px,env(safe-area-inset-bottom))]
            md:px-6
            md:pb-4
          "
        >

          <div
            className="
              max-w-3xl
              mx-auto
              flex
              items-end
              gap-2
              rounded-3xl
              border
              bg-muted/40
              px-3
              py-2
              shadow-sm
              focus-within:ring-1
              focus-within:ring-ring
            "
          >

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleInputKeyDown}
              placeholder="Message StudyTime AI..."
              rows={1}
              disabled={loading}
              className="
                flex-1
                min-h-[40px]
                max-h-32
                resize-none
                bg-transparent
                border-0
                outline-none
                px-2
                py-2
                text-sm
                leading-5
                placeholder:text-muted-foreground
              "
            />

            <Button
              size="icon"
              className="
                h-10
                w-10
                shrink-0
                rounded-full
              "
              disabled={!input.trim() || loading}
              onClick={sendMessage}
              aria-label="Send message"
            >
              <span className="text-base">
                ➤
              </span>
            </Button>

          </div>

        </div>

      </main>


      {/* ================================================================== */}
      {/* CHAT HISTORY DRAWER                                                */}
      {/* ================================================================== */}

      {showChatList && (

        <>

          {/* Backdrop */}

          <button
            type="button"
            aria-label="Close chat history"
            className="
              fixed
              inset-0
              z-40
              bg-black/40
              backdrop-blur-[1px]
              border-0
              p-0
              cursor-default
            "
            onClick={() => {
              setShowChatList(false);
              setSelectionMode(false);
              setSelectedChats(new Set());
            }}
          />


          {/* Drawer */}

          <aside
            className="
              fixed
              left-0
              top-0
              bottom-0
              z-50
              w-[min(86vw,340px)]
              bg-background
              border-r
              shadow-xl
              flex
              flex-col
            "
            role="dialog"
            aria-label="Chat history"
          >

            {/* Drawer header */}

            <div
              className="
                shrink-0
                h-14
                flex
                items-center
                justify-between
                px-3
                border-b
              "
            >

              {selectionMode ? (

                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={exitSelectionMode}
                  >
                    <X className="h-5 w-5" />
                  </Button>

                  <span className="text-sm font-medium">
                    {selectedChats.size} selected
                  </span>

                  <Button
                    variant="destructive"
                    size="icon"
                    disabled={selectedChats.size === 0}
                    onClick={deleteSelectedChats}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </>

              ) : (

                <>
                  <h2 className="font-semibold">
                    Chat history
                  </h2>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setShowChatList(false)
                    }
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </>

              )}

            </div>


            {/* New chat */}

            {!selectionMode && (
              <div className="p-3">

                <Button
                  className="w-full justify-start gap-2"
                  onClick={startNewChat}
                >
                  <Plus className="h-4 w-4" />
                  New chat
                </Button>

              </div>
            )}


            {/* Search */}

            {!selectionMode && (
              <div className="px-3 pb-3">

                <div
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-xl
                    border
                    bg-muted/30
                    px-3
                  "
                >

                  <Search
                    className="
                      h-4
                      w-4
                      shrink-0
                      text-muted-foreground
                    "
                  />

                  <input
                    value={chatSearch}
                    onChange={(event) =>
                      setChatSearch(event.target.value)
                    }
                    placeholder="Search chats..."
                    className="
                      h-10
                      min-w-0
                      flex-1
                      bg-transparent
                      text-sm
                      outline-none
                    "
                  />

                </div>

              </div>
            )}


            {/* Conversation list */}

            <ScrollArea className="flex-1 min-h-0">

              <div className="px-2 pb-5">

                {Object.entries(
                  groupedConversations
                ).map(([group, items]) => {

                  if (!items.length) {
                    return null;
                  }

                  return (
                    <section
                      key={group}
                      className="mb-5"
                    >

                      <div
                        className="
                          px-2
                          py-2
                          text-xs
                          font-medium
                          text-muted-foreground
                        "
                      >
                        {group}
                      </div>


                      <div className="space-y-1">

                        {items.map(
                          (conversation) => {

                            const selected =
                              selectedChats.has(
                                conversation.id
                              );

                            const isRenaming =
                              renamingChatId ===
                              conversation.id;

                            return (
                              <div
                                key={conversation.id}
                                className="
                                  relative
                                  rounded-xl
                                  overflow-hidden
                                "
                                onPointerDown={() =>
                                  startLongPress(
                                    conversation
                                  )
                                }
                                onPointerUp={
                                  cancelLongPress
                                }
                                onPointerLeave={
                                  cancelLongPress
                                }
                                onPointerCancel={
                                  cancelLongPress
                                }
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
                                          event.target
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
                                    />

                                    <Button
                                      size="icon"
                                      className="h-9 w-9"
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
                                      text-left
                                      px-3
                                      py-3
                                      rounded-xl
                                      transition-colors
                                      ${
                                        selected
                                          ? "bg-primary/10"
                                          : "hover:bg-muted"
                                      }
                                    `}
                                    onClick={() => {

                                      if (
                                        selectionMode
                                      ) {
                                        toggleSelectedChat(
                                          conversation.id
                                        );
                                      } else {
                                        openConversation(
                                          conversation.id
                                        );
                                      }

                                    }}
                                  >

                                    {selectionMode && (
                                      <div
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
                                              : ""
                                          }
                                        `}
                                      >
                                        {selected && (
                                          <Check className="h-3.5 w-3.5" />
                                        )}
                                      </div>
                                    )}


                                    <div
                                      className="
                                        min-w-0
                                        flex-1
                                      "
                                    >

                                      <div
                                        className="
                                          truncate
                                          text-sm
                                        "
                                      >
                                        {
                                          conversation.title ||
                                          "New chat"
                                        }
                                      </div>

                                    </div>


                                    {conversation.pinned &&
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
                  );
                })}


                {filteredConversations.length === 0 && (

                  <div
                    className="
                      px-4
                      py-10
                      text-center
                      text-sm
                      text-muted-foreground
                    "
                  >
                    No chats found.
                  </div>

                )}

              </div>

            </ScrollArea>


            {/* Selection mode footer */}

            {!selectionMode &&
              conversations.length > 0 && (

                <div
                  className="
                    shrink-0
                    border-t
                    p-3
                  "
                >

                  <Button
                    variant="ghost"
                    className="
                      w-full
                      justify-start
                      text-muted-foreground
                    "
                    onClick={enterSelectionMode}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Select chats
                  </Button>

                </div>

              )}

          </aside>

        </>

      )}


      {/* ================================================================== */}
      {/* LONG-PRESS ACTION CARD                                             */}
      {/* ================================================================== */}

      {showActionCard && actionChat && (

        <div
          className="
            fixed
            inset-0
            z-[70]
            flex
            items-end
            justify-center
            p-3
            sm:items-center
          "
        >

          {/* Backdrop */}

          <button
            type="button"
            aria-label="Close actions"
            className="
              absolute
              inset-0
              bg-black/40
              backdrop-blur-[2px]
              border-0
            "
            onClick={() => {
              setShowActionCard(false);
              setActionChat(null);
            }}
          />


          {/* Native-style action card */}

          <div
            className="
              relative
              w-full
              max-w-sm
              overflow-hidden
              rounded-2xl
              border
              bg-background
              shadow-2xl
              animate-in
              slide-in-from-bottom-3
              duration-150
            "
          >

            <div className="px-4 py-3 border-b">

              <div
                className="
                  text-sm
                  font-medium
                  truncate
                "
              >
                {actionChat.title ||
                  "New chat"}
              </div>

              <div
                className="
                  text-xs
                  text-muted-foreground
                  mt-1
                "
              >
                Chat actions
              </div>

            </div>


            <div className="p-2">

              {/* PIN */}

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

                {actionChat.pinned ? (
                  <PinOff className="h-5 w-5" />
                ) : (
                  <Pin className="h-5 w-5" />
                )}

                <span className="text-sm">
                  {actionChat.pinned
                    ? "Unpin"
                    : "Pin"}
                </span>

              </button>


              {/* RENAME */}

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
                  beginRename(actionChat)
                }
              >

                <Pencil className="h-5 w-5" />

                <span className="text-sm">
                  Rename
                </span>

              </button>


              {/* DELETE */}

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

                  setShowActionCard(false);

                  setActionChat(null);

                  await deleteConversation(
                    actionChat.id
                  );

                }}
              >

                <Trash2 className="h-5 w-5" />

                <span className="text-sm">
                  Delete
                </span>

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}