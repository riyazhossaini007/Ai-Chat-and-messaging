import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { aiAvatarChats } from "../components/sidebarComponents/aiAvatarChats";
import { createOrGetPrivateChat, fetchChats } from "../api/chat.api";
import { useChatStore, toChatListItem } from "../stores/chatStore";
import { useAuthStore } from "../stores/authStore";
import { detectSearchIntent } from "../utils/detectSearchIntent";
import type {
  SearchResultItem,
  SearchResultSection,
} from "../type/search";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionAlternativeLike>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

const PAGE_COMMANDS = [
  { id: "dashboard", title: "Dashboard", path: "/home", keywords: ["dashboard", "home"] },
  { id: "profile", title: "Profile", path: "/profilepage", keywords: ["profile", "account"] },
  { id: "settings", title: "Settings", path: "/settings", keywords: ["settings", "preferences"] },
  { id: "ai-chats", title: "AI Chats", path: "/ai", keywords: ["ai", "chats", "assistant"] },
  { id: "semantic-search", title: "Semantic Search", path: "/search", keywords: ["search", "semantic", "memory search"] },
  { id: "communities", title: "Communities", path: "/groups", keywords: ["communities", "groups"] },
  { id: "jobs", title: "Jobs", path: "/jobs", keywords: ["jobs", "hiring", "careers"] },
  { id: "startup-hub", title: "Startup Hub", path: "/startup-hub", keywords: ["startup", "hub"] },
] as const;

const buildStaticAiHistory = () =>
  Object.values(aiAvatarChats).flatMap((items) =>
    items.map((item) => ({
      id: item.id,
      title: item.title,
      preview: item.title,
    }))
  );

const containsValue = (value: string | undefined, keyword: string) =>
  Boolean(value?.toLowerCase().includes(keyword));

const getVoiceNavigationPath = (input: string): string | null => {
  const normalized = input
    .toLowerCase()
    .replace(/[^\w\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const commandMatch = normalized.match(/^(?:open|go to|goto|navigate to)\s+(.+)$/);
  const targetRaw = commandMatch ? commandMatch[1] : normalized;
  const target = targetRaw.replace(/\s+page$/, "").trim();

  if (!target) return null;

  const directVoiceAliases: Array<{ terms: string[]; path: string }> = [
    { terms: ["ai", "ai page", "ai chat", "open ai"], path: "/ai" },
    { terms: ["search", "semantic search", "memory search"], path: "/search" },
    { terms: ["group", "groups", "group page", "communities", "community"], path: "/groups" },
    { terms: ["chat", "chats", "chat page"], path: "/chat" },
    { terms: ["home", "dashboard"], path: "/home" },
    { terms: ["settings", "setting"], path: "/settings" },
    { terms: ["profile", "account"], path: "/profilepage" },
    { terms: ["credits", "billing"], path: "/credits" },
  ];

  const aliasMatch = directVoiceAliases.find((entry) => entry.terms.includes(target));
  if (aliasMatch) return aliasMatch.path;

  const pageMatch = PAGE_COMMANDS.find((page) => {
    const haystacks = [page.title.toLowerCase(), ...page.keywords];
    return haystacks.some((value) => value === target || value.includes(target));
  });

  return pageMatch?.path ?? null;
};

export const useUniversalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const token = useAuthStore((store) => store.token);
  const authUserId = useAuthStore((store) => store.user?.id);

  const chats = useChatStore((store) => store.chats);
  const nearbyUsers = useChatStore((store) => store.nearbyUsers);
  const onlineUsers = useChatStore((store) => store.onlineUsers);
  const setChats = useChatStore((store) => store.setChats);
  const loadNearbyUsers = useChatStore((store) => store.loadNearbyUsers);

  const hydratedRef = useRef(false);
  const aiNavigateLockRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const staticAiHistory = useMemo(() => buildStaticAiHistory(), []);

  const executeVoiceTranscript = (transcript: string) => {
    const cleaned = transcript.trim();
    if (!cleaned) return;

    setQuery(cleaned);

    const route = getVoiceNavigationPath(cleaned);
    if (route) {
      navigate(route);
      setQuery("");
      setActiveIndex(-1);
      return;
    }

    const voiceIntent = detectSearchIntent(cleaned);
    if (voiceIntent === "AI_CONTEXT_SEARCH") {
      navigate(`/ai/${uuid()}`, { state: { initialMessage: cleaned } });
      setQuery("");
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const normalized = query.trim().toLowerCase();

    if (normalized !== "@ai") {
      aiNavigateLockRef.current = false;
      return;
    }

    if (aiNavigateLockRef.current) return;
    aiNavigateLockRef.current = true;

    const lastAiChat = [...chats]
      .filter((chat) => chat.type === "AI")
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      )[0];

    navigate(lastAiChat ? `/ai/${lastAiChat.id}` : `/ai/${uuid()}`);
    setQuery("");
  }, [chats, navigate, query]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const intent = detectSearchIntent(debouncedQuery);
    const needsSearchData =
      intent === "USER_CHAT_SEARCH" || intent === "AI_CONTEXT_SEARCH";

    if (!needsSearchData) return;
    if (!token || hydratedRef.current) return;

    hydratedRef.current = true;
    setLoading(true);

    void Promise.allSettled([
      fetchChats().then((data) => setChats(data)),
      loadNearbyUsers(),
    ]).finally(() => setLoading(false));
  }, [debouncedQuery, loadNearbyUsers, setChats, token]);

  const intent = detectSearchIntent(debouncedQuery);
  const normalizedDebounced = debouncedQuery.trim().toLowerCase();

  const sections = useMemo<SearchResultSection[]>(() => {
    if (!normalizedDebounced) return [];

    if (intent === "USER_CHAT_SEARCH") {
      const keyword = normalizedDebounced.slice(1).trim();
      if (!keyword) return [];

      const userItems: SearchResultItem[] = nearbyUsers
        .filter((user) =>
          containsValue(user.username, keyword) || containsValue(user.name, keyword)
        )
        .map((user) => ({
          id: `user-${user.id}`,
          type: "user",
          title: `@${user.username}`,
          subtitle: user.name,
          avatar: user.avatar ?? undefined,
          online: onlineUsers.has(user.id),
          matchText: keyword,
          onSelect: async () => {
            const chat = await createOrGetPrivateChat({ userId: user.id });
            navigate(`/chat/${chat.id}`);
          },
        }));

      const chatItems: SearchResultItem[] = chats
        .filter((chat) => chat.type === "DIRECT" || chat.type === "GROUP")
        .map((chat) => toChatListItem(chat, authUserId))
        .filter((chat) => {
          return (
            containsValue(chat.title, keyword) ||
            containsValue(chat.username, keyword) ||
            containsValue(chat.rawLastMessage, keyword)
          );
        })
        .map((chat) => ({
          id: `chat-${chat.chatId}`,
          type: "chat",
          title: chat.type === "GROUP" ? chat.title : `@${chat.username}`,
          subtitle: chat.type === "GROUP" ? "Group chat" : chat.title,
          preview: chat.lastMessage,
          avatar: chat.avatar,
          online: chat.peerUserId ? onlineUsers.has(chat.peerUserId) : undefined,
          matchText: keyword,
          onSelect: () => {
            if (chat.type === "GROUP") {
              if (!chat.groupId) return;
              navigate(`/groups/${chat.groupId}`);
              return;
            }
            navigate(`/chat/${chat.chatId}`);
          },
        }));

      const resultSections: SearchResultSection[] = [];
      if (userItems.length) {
        resultSections.push({ id: "users", title: "User Accounts", items: userItems });
      }
      if (chatItems.length) {
        resultSections.push({ id: "chats", title: "Chats", items: chatItems });
      }

      return resultSections;
    }

    if (intent === "PAGE_COMMAND") {
      const keyword = normalizedDebounced.slice(1).trim();

      const pageItems: SearchResultItem[] = PAGE_COMMANDS.filter((page) => {
        if (!keyword) return true;
        const haystacks = [page.title.toLowerCase(), page.path.toLowerCase(), ...page.keywords];
        return haystacks.some((value) => value.includes(keyword));
      }).map((page) => ({
        id: `page-${page.id}`,
        type: "page",
        title: page.title,
        subtitle: page.path,
        matchText: keyword,
        onSelect: () => {
          navigate(page.path);
        },
      }));

      return pageItems.length
        ? [{ id: "pages", title: "Platform Pages", items: pageItems }]
        : [];
    }

    if (intent === "AI_CONTEXT_SEARCH") {
      const keyword = normalizedDebounced;

      const previousHistoryFromChats: Array<{
        id: string;
        title: string;
        preview: string;
      }> = chats
        .filter((chat) => chat.type === "AI")
        .map((chat) => {
          const preview =
            chat.messages[0]?.content?.trim() || `AI session ${chat.id.slice(0, 8)}`;
          return {
            id: chat.id,
            title: preview.slice(0, 80),
            preview,
          };
        });

      const aiHistoryMap = new Map<string, { id: string; title: string; preview: string }>();
      [...previousHistoryFromChats, ...staticAiHistory].forEach((entry) => {
        if (!aiHistoryMap.has(entry.id)) {
          aiHistoryMap.set(entry.id, entry);
        }
      });

      const previousChatItems: SearchResultItem[] = [...aiHistoryMap.values()]
        .filter(
          (item) =>
            containsValue(item.title, keyword) || containsValue(item.preview, keyword)
        )
        .map((item) => ({
          id: `ai-history-${item.id}`,
          type: "ai-history",
          title: item.title,
          preview: item.preview,
          matchText: keyword,
          onSelect: () => {
            navigate(`/ai/${item.id}`, { state: { initialMessage: debouncedQuery.trim() } });
          },
        }));

      const prompts = [
        `Ask AI about ${debouncedQuery.trim()}`,
        `Summarize ${debouncedQuery.trim()}`,
      ];

      const promptItems: SearchResultItem[] = prompts.map((prompt, index) => ({
        id: `ai-prompt-${index}`,
        type: "ai-prompt",
        title: prompt,
        matchText: keyword,
        onSelect: () => {
          navigate(`/ai/${uuid()}`, { state: { initialMessage: prompt } });
        },
      }));

      const resultSections: SearchResultSection[] = [];
      if (previousChatItems.length) {
        resultSections.push({
          id: "ai-history",
          title: "Previous AI Chats",
          items: previousChatItems,
        });
      }
      resultSections.push({
        id: "ai-prompts",
        title: "New AI Prompt Suggestions",
        items: promptItems,
      });

      return resultSections;
    }

    return [];
  }, [
    authUserId,
    chats,
    debouncedQuery,
    intent,
    navigate,
    nearbyUsers,
    normalizedDebounced,
    onlineUsers,
    staticAiHistory,
  ]);

  const flatResults = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  useEffect(() => {
    if (!flatResults.length) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex(0);
  }, [flatResults]);

  const selectResult = async (result: SearchResultItem) => {
    await result.onSelect();
    setQuery("");
    setActiveIndex(-1);
  };

  const submit = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const directRoute = getVoiceNavigationPath(trimmed);
    if (directRoute) {
      navigate(directRoute);
      setQuery("");
      setActiveIndex(-1);
      return;
    }

    const activeResult = activeIndex >= 0 ? flatResults[activeIndex] : undefined;
    if (activeResult) {
      await selectResult(activeResult);
      return;
    }

    if (flatResults.length > 0) {
      await selectResult(flatResults[0]);
      return;
    }

    const liveIntent = detectSearchIntent(trimmed);
    if (liveIntent === "AI_CONTEXT_SEARCH") {
      navigate(`/ai/${uuid()}`, { state: { initialMessage: trimmed } });
      setQuery("");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "ArrowDown") {
      if (!flatResults.length) return;
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      if (!flatResults.length) return;
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? flatResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const emptyMessage = useMemo(() => {
    if (!query.trim()) return null;
    if (loading) return "Searching...";

    if (intent === "USER_CHAT_SEARCH" && !normalizedDebounced.slice(1).trim()) {
      return "Type after @ to search users and chats.";
    }

    if (sections.length === 0) {
      return "No matches found.";
    }

    return null;
  }, [intent, loading, normalizedDebounced, query, sections.length]);

  const startVoiceInput = () => {
    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };

    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceError("Voice recognition is not supported in this browser.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceError(null);
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        const reason = event?.error ? ` (${event.error})` : "";
        setVoiceError(`Voice recognition failed${reason}.`);
        setIsListening(false);
      };

      recognition.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript?.trim();
        if (!transcript) return;
        executeVoiceTranscript(transcript);
      };

      recognitionRef.current = recognition;
    }

    try {
      setVoiceError(null);
      recognitionRef.current.start();
    } catch {
      setVoiceError("Voice recognition is already running.");
    }
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return {
    query,
    setQuery,
    submit,
    intent,
    sections,
    activeIndex,
    setActiveIndex,
    onKeyDown,
    selectResult,
    showResults: query.trim().length > 0,
    emptyMessage,
    loading,
    isListening,
    voiceError,
    startVoiceInput,
    stopVoiceInput,
  };
};


