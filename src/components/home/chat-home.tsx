"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import {
  CaretDown,
  ChatCircleDots,
  GearSix,
  HouseLine,
  ImageSquare,
  List,
  PaperPlaneTilt,
  Plus,
  SignOut,
  Sparkle,
  SpinnerGap,
  SunHorizon,
  X,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { AuthErrorResponse, AuthUser } from "@/lib/auth/types";
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_MESSAGE_MAX_ATTACHMENTS,
  validateChatAttachmentFile,
} from "@/lib/chat/attachments";
import type {
  ChatAttachmentItem,
  ChatBootstrapResponse,
  ChatMessageItem,
  ChatMessageStreamEvent,
  ChatStreamCompletionData,
  ChatThreadResponse,
  ChatThreadSummary,
} from "@/lib/chat/types";
import { SettingsPanel } from "@/components/home/settings-panel";
import { UserAvatar } from "@/components/home/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const suggestionPrompts = [
  "Quero conversar sobre como meu dia comecou.",
  "Preciso organizar o que estou sentindo agora.",
  "Me ajuda a encontrar um passo pequeno para hoje?",
];

const STREAM_FLUSH_DELAY_MS = 48;
const threadDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

type DraftAttachment = {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

function firstName(name: string) {
  return name.trim().split(" ")[0] || name;
}

function getApiMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<AuthErrorResponse>;
  return axiosError.response?.data.message || fallback;
}

function formatThreadDate(value: string) {
  return threadDateFormatter.format(new Date(value));
}

function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildVersionedAvatarUrl(avatarUrl: string, avatarVersion: number) {
  return `${avatarUrl}?v=${avatarVersion}`;
}

function buildDraftAttachment(file: File): DraftAttachment {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    name: file.name || "imagem",
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

function toOptimisticAttachment(attachment: DraftAttachment): ChatAttachmentItem {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: attachment.previewUrl,
  };
}

function getDistanceFromConversationBottom(element: HTMLDivElement | null) {
  if (!element) {
    return 0;
  }

  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

function isNearConversationBottom(element: HTMLDivElement | null) {
  return getDistanceFromConversationBottom(element) <= 64;
}

function scrollConversationToBottom(
  element: HTMLDivElement | null,
  behavior: ScrollBehavior = "smooth",
) {
  element?.scrollTo({
    top: element.scrollHeight,
    behavior,
  });
}

function upsertThreadSummary(
  currentThreads: ChatThreadSummary[],
  nextThread: ChatThreadSummary,
) {
  return [
    nextThread,
    ...currentThreads.filter((thread) => thread.id !== nextThread.id),
  ];
}

const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
}: {
  message: ChatMessageItem;
}) {
  const hasAttachments = message.attachments.length > 0;
  const showTypingDots =
    message.role === "assistant" && !message.content && !hasAttachments;

  return (
    <div
      className={`chat-message-bubble text-sm leading-7 ${
        message.role === "user"
          ? "ml-auto max-w-2xl rounded-[1.7rem] border border-[#ffb36f]/34 bg-[linear-gradient(180deg,rgba(255,138,92,0.22),rgba(255,209,102,0.16))] px-5 py-4 text-[#fff7ed] shadow-[0_18px_50px_rgba(255,138,92,0.18)]"
          : "max-w-3xl border-l border-[#67e8c6]/20 bg-transparent py-2 pl-4 text-[#ecf7fb] shadow-none"
      }`}
    >
      <p
        className={`mb-2 uppercase tracking-[0.28em] ${
          message.role === "user"
            ? "text-[12px] text-[#ffe6bc]/78"
            : "text-[11px] text-[#67e8c6]/62"
        }`}
      >
        {message.role === "user" ? "voce" : "casa aurora"}
      </p>

      {hasAttachments ? (
        <div
          className={`grid gap-3 ${message.content ? "mb-4" : ""} sm:grid-cols-2`}
        >
          {message.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#061722]/55"
            >
              <Image
                src={attachment.url}
                alt={attachment.name}
                width={960}
                height={720}
                unoptimized
                className="h-52 w-full object-cover"
              />
              <div className="border-t border-white/8 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/54">
                <p className="truncate">{attachment.name}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {message.content ? (
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      ) : showTypingDots ? (
        <span className="inline-flex items-center gap-1 text-white/52">
          <span className="size-1.5 rounded-full bg-current animate-pulse" />
          <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:160ms]" />
          <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:320ms]" />
        </span>
      ) : null}
    </div>
  );
});

export function ChatHome({ user }: { user: AuthUser }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const conversationViewportRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftAttachmentsRef = useRef<DraftAttachment[]>([]);
  const streamingChunkQueueRef = useRef("");
  const streamingFlushTimerRef = useRef<number | null>(null);
  const pendingDoneDataRef = useRef<ChatStreamCompletionData | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastConversationScrollTopRef = useRef(0);
  const previousMessageCountRef = useRef(0);
  const previousStreamingContentRef = useRef("");
  const previousComposerHeightRef = useRef(176);
  const previousThreadIdRef = useRef<string | null>(null);
  const previousIsSendingRef = useRef(false);
  const [currentUser, setCurrentUser] = useState(user);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [optimisticMessage, setOptimisticMessage] =
    useState<ChatMessageItem | null>(null);
  const [streamingMessage, setStreamingMessage] =
    useState<ChatMessageItem | null>(null);
  const [composerHeight, setComposerHeight] = useState(176);

  const hasMessages =
    messages.length > 0 || optimisticMessage !== null || streamingMessage !== null;
  const canSubmitMessage = Boolean(prompt.trim() || draftAttachments.length > 0);
  const isOpeningThread = isLoadingThread && pendingThreadId !== null;
  const sidebarTogglePositionClass = isSidebarOpen
    ? "left-[14rem] xl:left-[calc(18rem+1rem)]"
    : "left-4";
  const currentAvatarUrl = buildVersionedAvatarUrl(
    currentUser.avatarUrl,
    avatarVersion,
  );

  const visibleMessages = useMemo(() => {
    const nextMessages = [...messages];

    if (optimisticMessage) {
      nextMessages.push(optimisticMessage);
    }

    if (streamingMessage) {
      nextMessages.push(streamingMessage);
    }

    return nextMessages;
  }, [messages, optimisticMessage, streamingMessage]);

  useEffect(() => {
    draftAttachmentsRef.current = draftAttachments;
  }, [draftAttachments]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";

    const nextHeight = Math.min(textarea.scrollHeight, 240);
    textarea.style.height = `${nextHeight}px`;
  }, [prompt]);

  useLayoutEffect(() => {
    const composerElement = composerRef.current;

    if (!composerElement) {
      return;
    }

    const updateComposerHeight = () => {
      setComposerHeight(composerElement.offsetHeight);
    };

    updateComposerHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateComposerHeight();
    });

    observer.observe(composerElement);

    return () => {
      observer.disconnect();
    };
  }, [hasMessages, draftAttachments.length]);

  useEffect(() => {
    const conversationViewport = conversationViewportRef.current;

    if (!hasMessages || !conversationViewport) {
      shouldAutoScrollRef.current = true;
      lastConversationScrollTopRef.current = 0;
      return;
    }

    lastConversationScrollTopRef.current = conversationViewport.scrollTop;

    const syncAutoScroll = () => {
      const nextScrollTop = conversationViewport.scrollTop;
      const isScrollingUp = nextScrollTop < lastConversationScrollTopRef.current;
      const isNearBottom = isNearConversationBottom(conversationViewport);

      lastConversationScrollTopRef.current = nextScrollTop;

      if (isScrollingUp && !isNearBottom) {
        shouldAutoScrollRef.current = false;
        return;
      }

      shouldAutoScrollRef.current = isNearBottom;
    };

    syncAutoScroll();

    conversationViewport.addEventListener("scroll", syncAutoScroll, {
      passive: true,
    });
    window.addEventListener("resize", syncAutoScroll);

    return () => {
      conversationViewport.removeEventListener("scroll", syncAutoScroll);
      window.removeEventListener("resize", syncAutoScroll);
    };
  }, [activeThreadId, hasMessages]);

  useLayoutEffect(() => {
    if (!hasMessages) {
      previousMessageCountRef.current = 0;
      previousStreamingContentRef.current = "";
      previousThreadIdRef.current = activeThreadId;
      previousComposerHeightRef.current = composerHeight;
      previousIsSendingRef.current = isSending;
      shouldAutoScrollRef.current = true;
      return;
    }

    const threadChanged = previousThreadIdRef.current !== activeThreadId;
    const messageCountChanged =
      previousMessageCountRef.current !== visibleMessages.length;
    const streamingContentChanged =
      previousStreamingContentRef.current !== (streamingMessage?.content ?? "");
    const composerHeightChanged =
      previousComposerHeightRef.current !== composerHeight;
    const sendingStarted = isSending && !previousIsSendingRef.current;
    const shouldScroll =
      threadChanged ||
      (shouldAutoScrollRef.current &&
        (
          messageCountChanged ||
          streamingContentChanged ||
          composerHeightChanged ||
          sendingStarted
        ));

    if (shouldScroll) {
      const behavior =
        threadChanged ||
        composerHeightChanged ||
        sendingStarted ||
        streamingContentChanged
          ? "auto"
          : "smooth";

      requestAnimationFrame(() => {
        scrollConversationToBottom(conversationViewportRef.current, behavior);
      });
    }

    previousMessageCountRef.current = visibleMessages.length;
    previousStreamingContentRef.current = streamingMessage?.content ?? "";
    previousThreadIdRef.current = activeThreadId;
    previousComposerHeightRef.current = composerHeight;
    previousIsSendingRef.current = isSending;
  }, [
    activeThreadId,
    composerHeight,
    hasMessages,
    isSending,
    streamingMessage?.content,
    visibleMessages.length,
  ]);

  async function loadBootstrap() {
    setIsLoadingHistory(true);
    setLoadError(null);

    try {
      const { data } = await api.get<ChatBootstrapResponse>("/api/chat/bootstrap");
      setThreads(data.threads);
      setActiveThreadId(data.activeThreadId);
      setMessages(data.messages);
    } catch (error) {
      setLoadError(
        getApiMessage(error, "Nao foi possivel carregar suas conversas agora."),
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function revokeDraftAttachmentPreviews(attachments: DraftAttachment[]) {
    attachments.forEach((attachment) => {
      URL.revokeObjectURL(attachment.previewUrl);
    });
  }

  function clearDraftAttachments() {
    setDraftAttachments((currentAttachments) => {
      revokeDraftAttachmentPreviews(currentAttachments);
      return [];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeDraftAttachment(attachmentId: string) {
    setDraftAttachments((currentAttachments) => {
      const attachmentToRemove = currentAttachments.find(
        (attachment) => attachment.id === attachmentId,
      );

      if (attachmentToRemove) {
        URL.revokeObjectURL(attachmentToRemove.previewUrl);
      }

      return currentAttachments.filter(
        (attachment) => attachment.id !== attachmentId,
      );
    });
  }

  useEffect(() => {
    setIsHydrated(true);
    void loadBootstrap();
  }, []);

  useEffect(() => {
    return () => {
      if (
        streamingFlushTimerRef.current !== null &&
        typeof window !== "undefined"
      ) {
        window.clearTimeout(streamingFlushTimerRef.current);
      }

      revokeDraftAttachmentPreviews(draftAttachmentsRef.current);
      streamingFlushTimerRef.current = null;
      streamingChunkQueueRef.current = "";
      pendingDoneDataRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) {
      setIsProfileMenuOpen(false);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: Event) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!profileMenuRef.current?.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (!isAttachmentMenuOpen) {
      return;
    }

    const handlePointerDown = (event: Event) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!attachmentMenuRef.current?.contains(target)) {
        setIsAttachmentMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isAttachmentMenuOpen]);

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[linear-gradient(140deg,_#07131d_0%,_#0d2430_48%,_#0b1520_100%)] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="h-[72vh] animate-pulse rounded-[2rem] border border-white/10 bg-white/6" />
        </div>
      </main>
    );
  }

  async function handleSelectThread(threadId: string) {
    if (threadId === activeThreadId || isLoadingThread || isSending) {
      return;
    }

    setPendingThreadId(threadId);
    setIsLoadingThread(true);
    setLoadError(null);
    setIsSidebarOpen(false);
    setIsProfileMenuOpen(false);
    setIsAttachmentMenuOpen(false);

    try {
      const { data } = await api.get<ChatThreadResponse>(
        `/api/chat/threads/${threadId}`,
      );
      clearDraftAttachments();
      setActiveThreadId(data.threadId);
      setMessages(data.messages);
      setPrompt("");
      setOptimisticMessage(null);
      setStreamingMessage(null);
    } catch (error) {
      setLoadError(
        getApiMessage(error, "Nao foi possivel abrir esta conversa agora."),
      );
    } finally {
      setIsLoadingThread(false);
      setPendingThreadId(null);
    }
  }

  function handleNewConversation() {
    if (isSending) {
      return;
    }

    clearDraftAttachments();
    setActiveThreadId(null);
    setMessages([]);
    setPrompt("");
    setLoadError(null);
    setOptimisticMessage(null);
    setStreamingMessage(null);
    setPendingThreadId(null);
    setIsProfileMenuOpen(false);
    setIsAttachmentMenuOpen(false);

    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setIsSidebarOpen(false);
    }
  }

  function handleOpenSettings() {
    setIsSettingsOpen(true);
    setIsProfileMenuOpen(false);

    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setIsSidebarOpen(false);
    }
  }

  function handleCloseSettings() {
    setIsSettingsOpen(false);
  }

  function handlePhotoSaved(nextUser: AuthUser, uploadedAt: number) {
    setCurrentUser(nextUser);
    setAvatarVersion(uploadedAt);
  }

  function handleAttachmentInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    event.currentTarget.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    setLoadError(null);
    setIsAttachmentMenuOpen(false);
    setDraftAttachments((currentAttachments) => {
      const nextAttachments = [...currentAttachments];

      for (const file of selectedFiles) {
        if (nextAttachments.length >= CHAT_MESSAGE_MAX_ATTACHMENTS) {
          setLoadError(
            `Voce pode enviar ate ${CHAT_MESSAGE_MAX_ATTACHMENTS} imagens por mensagem.`,
          );
          break;
        }

        const validationMessage = validateChatAttachmentFile(file);

        if (validationMessage) {
          setLoadError(validationMessage);
          continue;
        }

        nextAttachments.push(buildDraftAttachment(file));
      }

      return nextAttachments;
    });
  }

  function appendToStreamingMessage(content: string) {
    if (!content) {
      return;
    }

    setStreamingMessage((currentMessage) => {
      if (!currentMessage) {
        return {
          id: `streaming-${Date.now()}`,
          role: "assistant",
          content,
          attachments: [],
          createdAt: new Date().toISOString(),
        };
      }

      return {
        ...currentMessage,
        content: currentMessage.content + content,
      };
    });
  }

  function finalizeStreamingReply() {
    if (streamingChunkQueueRef.current || !pendingDoneDataRef.current) {
      return;
    }

    const data = pendingDoneDataRef.current;
    pendingDoneDataRef.current = null;

    setThreads((currentThreads) => upsertThreadSummary(currentThreads, data.thread));
    setActiveThreadId(data.activeThreadId);
    setMessages((currentMessages) => {
      const currentIds = new Set(currentMessages.map((message) => message.id));
      const nextMessages = [...currentMessages];

      if (!currentIds.has(data.userMessage.id)) {
        nextMessages.push(data.userMessage);
      }

      if (!currentIds.has(data.assistantMessage.id)) {
        nextMessages.push(data.assistantMessage);
      }

      return nextMessages;
    });
    clearDraftAttachments();
    setOptimisticMessage(null);
    setStreamingMessage(null);
    setIsAttachmentMenuOpen(false);
    setIsSending(false);
  }

  function stopStreamingFlush() {
    if (
      streamingFlushTimerRef.current !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(streamingFlushTimerRef.current);
      streamingFlushTimerRef.current = null;
    }
  }

  function flushStreamingChunks() {
    stopStreamingFlush();

    if (streamingChunkQueueRef.current) {
      const nextChunk = streamingChunkQueueRef.current;
      streamingChunkQueueRef.current = "";
      appendToStreamingMessage(nextChunk);
    }

    finalizeStreamingReply();
  }

  function scheduleStreamingFlush() {
    if (typeof window === "undefined") {
      return;
    }

    if (streamingFlushTimerRef.current !== null) {
      return;
    }

    if (!streamingChunkQueueRef.current) {
      finalizeStreamingReply();
      return;
    }

    streamingFlushTimerRef.current = window.setTimeout(() => {
      streamingFlushTimerRef.current = null;
      flushStreamingChunks();
    }, STREAM_FLUSH_DELAY_MS);
  }

  function resetStreamingState() {
    stopStreamingFlush();
    streamingChunkQueueRef.current = "";
    pendingDoneDataRef.current = null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = prompt.trim();

    if ((!content && draftAttachments.length === 0) || isSending) {
      return;
    }

    const submittedAttachments = draftAttachments;
    const submittedPrompt = content;
    const formData = new FormData();

    if (activeThreadId) {
      formData.append("threadId", activeThreadId);
    }

    formData.append("content", submittedPrompt);

    submittedAttachments.forEach((attachment) => {
      formData.append("attachments", attachment.file, attachment.name);
    });

    setPrompt("");
    setLoadError(null);
    setIsSending(true);
    setOptimisticMessage({
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: submittedPrompt,
      attachments: submittedAttachments.map(toOptimisticAttachment),
      createdAt: new Date().toISOString(),
    });
    setStreamingMessage({
      id: `streaming-${Date.now()}`,
      role: "assistant",
      content: "",
      attachments: [],
      createdAt: new Date().toISOString(),
    });
    resetStreamingState();
    let receivedAssistantChunk = false;
    let receivedDoneEvent = false;

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as
          | AuthErrorResponse
          | null;

        throw new Error(
          errorBody?.message || "Nao foi possivel enviar sua mensagem agora.",
        );
      }

      if (!response.body) {
        throw new Error("A resposta chegou sem stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine) {
            continue;
          }

          const eventData = JSON.parse(trimmedLine) as ChatMessageStreamEvent;

          if (eventData.type === "thread") {
            setActiveThreadId(eventData.activeThreadId);
            setThreads((currentThreads) =>
              upsertThreadSummary(currentThreads, eventData.thread),
            );
            continue;
          }

          if (eventData.type === "chunk") {
            receivedAssistantChunk = true;
            streamingChunkQueueRef.current += eventData.content;
            scheduleStreamingFlush();
            continue;
          }

          if (eventData.type === "done") {
            receivedDoneEvent = true;
            pendingDoneDataRef.current = eventData.data;
            flushStreamingChunks();
            continue;
          }

          throw new Error(eventData.message);
        }

        if (done) {
          break;
        }
      }

      const trimmedBuffer = buffer.trim();

      if (trimmedBuffer) {
        const eventData = JSON.parse(trimmedBuffer) as ChatMessageStreamEvent;

        if (eventData.type === "done") {
          receivedDoneEvent = true;
          pendingDoneDataRef.current = eventData.data;
          flushStreamingChunks();
        } else if (eventData.type === "error") {
          throw new Error(eventData.message);
        }
      }

      if (!receivedDoneEvent) {
        throw new Error("A resposta foi interrompida antes de terminar.");
      }
    } catch (error) {
      resetStreamingState();

      if (!receivedAssistantChunk) {
        setPrompt(submittedPrompt);
      }

      setOptimisticMessage(null);
      setStreamingMessage(null);
      setIsSending(false);
      setLoadError(
        error instanceof Error
          ? error.message
          : getApiMessage(error, "Nao foi possivel enviar sua mensagem agora."),
      );
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (isLoadingHistory || isLoadingThread || isSending || !canSubmitMessage) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  }

  async function handleLogout() {
    setIsProfileMenuOpen(false);
    setIsLeaving(true);

    try {
      await api.post("/api/auth/logout");
      router.push("/auth");
      router.refresh();
    } finally {
      setIsLeaving(false);
    }
  }

  const composerStatusLabel =
    draftAttachments.length > 0
      ? `${draftAttachments.length} anexo${draftAttachments.length > 1 ? "s" : ""} pronto${draftAttachments.length > 1 ? "s" : ""}`
      : hasMessages
        ? "seguimos daqui"
        : "comecar com leveza";

  const composer = (
    <div ref={composerRef} className="mx-auto w-full max-w-5xl">
      <form
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-white/12 bg-[#071925]/58 p-3 shadow-[0_22px_90px_rgba(0,0,0,0.3)] backdrop-blur"
      >
        {draftAttachments.length > 0 && !isSending ? (
          <div className="scrollbar-hidden mb-4 flex gap-3 overflow-x-auto px-1 pb-1">
            {draftAttachments.map((attachment) => (
              <div key={attachment.id} className="w-28 shrink-0">
                <div className="relative overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#061722]/65">
                  <Image
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    width={240}
                    height={240}
                    unoptimized
                    className="h-24 w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full border border-black/10 bg-black/55 text-white transition hover:bg-black/72"
                    onClick={() => removeDraftAttachment(attachment.id)}
                    aria-label={`Remover ${attachment.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <p className="mt-2 truncate text-[10px] uppercase tracking-[0.18em] text-white/56">
                  {attachment.name}
                </p>
                <p className="text-[10px] text-white/34">
                  {formatAttachmentSize(attachment.sizeBytes)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-[1.5rem] border border-white/8 bg-[#113041]/38 px-4 py-4">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            rows={1}
            placeholder="Escreva com calma. Pode comecar do jeito que vier."
            className="scrollbar-hidden max-h-60 min-h-7 w-full resize-none overflow-y-auto bg-transparent text-sm leading-7 text-white outline-none placeholder:text-white/28"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <div ref={attachmentMenuRef} className="relative">
              {isAttachmentMenuOpen ? (
                <div className="absolute bottom-full left-0 z-10 mb-3 w-64 rounded-[1.35rem] border border-white/10 bg-[#081925]/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left text-sm text-white/78 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={
                      isSending ||
                      draftAttachments.length >= CHAT_MESSAGE_MAX_ATTACHMENTS
                    }
                  >
                    <div className="flex size-10 items-center justify-center rounded-full border border-[#7cc8ff]/18 bg-[#7cc8ff]/10 text-[#7cc8ff]">
                      <ImageSquare className="size-4" />
                    </div>
                    <div>
                      <p>Enviar imagem</p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                        JPG, PNG ou WebP ate 5 MB
                      </p>
                    </div>
                  </button>

                  <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.18em] text-white/28">
                    Ate {CHAT_MESSAGE_MAX_ATTACHMENTS} imagens e 2.5 MB no total
                  </p>
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                accept={CHAT_ATTACHMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={handleAttachmentInputChange}
              />

              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-[#112a38]/92 text-white/76 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/18 hover:bg-[#173a4d] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                aria-expanded={isAttachmentMenuOpen}
                aria-haspopup="menu"
                aria-label="Abrir menu de anexos"
                onClick={() => setIsAttachmentMenuOpen((current) => !current)}
                disabled={isLoadingHistory || isLoadingThread || isSending}
              >
                <Plus className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.26em] text-white/40">
              <SunHorizon className="size-4 text-[#ffd166]" />
              {composerStatusLabel}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="rounded-[1.2rem] bg-[linear-gradient(135deg,_#ff8a5c,_#ffd166)] px-5 text-[#081925] hover:brightness-105"
            disabled={
              isLoadingHistory ||
              isLoadingThread ||
              isSending ||
              !canSubmitMessage
            }
          >
            {isSending ? (
              <SpinnerGap className="size-4 animate-spin" />
            ) : (
              <PaperPlaneTilt className="size-4" weight="fill" />
            )}
            {isSending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,138,92,0.24),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(103,232,198,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(124,200,255,0.12),_transparent_28%),linear-gradient(140deg,_#07131d_0%,_#0d2430_48%,_#0b1520_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 auth-grid opacity-35" />

      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          className="fixed inset-0 z-20 bg-black/55 xl:hidden"
          onClick={() => {
            setIsSidebarOpen(false);
            setIsProfileMenuOpen(false);
            setIsAttachmentMenuOpen(false);
          }}
        />
      ) : null}

      <button
        type="button"
        aria-label={isSidebarOpen ? "Esconder sidebar" : "Expandir sidebar"}
        className={`fixed top-4 z-40 flex size-12 items-center justify-center rounded-full border border-white/10 bg-[#071925]/90 text-white/76 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur transition-all duration-300 hover:border-white/18 hover:bg-[#0e2836] hover:text-white ${sidebarTogglePositionClass}`}
        onClick={() => setIsSidebarOpen((current) => !current)}
      >
        <List className="size-4" />
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-white/10 bg-[#071925]/48 px-5 py-6 backdrop-blur transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <Badge className="border-[#ffd166]/25 bg-[#ffd166]/12 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[#fff1cc]">
            Casa Aurora
          </Badge>
          <div className="rounded-full border border-white/10 bg-white/6 p-2 text-white/68">
            <HouseLine className="size-4" />
          </div>
        </div>

        <div className="mt-6 flex h-12 items-center gap-2 rounded-[1.25rem] border border-[#67e8c6]/18 bg-[#67e8c6]/10 px-4 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <ChatCircleDots className="size-4 text-[#67e8c6]" />
          Conversas
        </div>

        <Button
          type="button"
          className="mt-3 h-12 justify-start rounded-[1.15rem] bg-[linear-gradient(135deg,_#67e8c6,_#7cc8ff)] text-[#081925] hover:brightness-105"
          onClick={handleNewConversation}
          disabled={isSending}
        >
          <Plus className="size-4" />
          Nova conversa
        </Button>

        <div className="scrollbar-hidden mt-8 flex-1 space-y-3 overflow-y-auto pr-1">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/44">
            Conversas recentes
          </p>

          {threads.length === 0 ? (
            <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-white/4 p-4 text-xs leading-6 text-white/54">
              Suas conversas vao aparecer aqui conforme forem acontecendo.
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`flex w-full cursor-pointer items-start gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition ${
                  pendingThreadId === thread.id
                    ? "border-[#67e8c6]/40 bg-[#67e8c6]/12 text-white shadow-[0_14px_36px_rgba(103,232,198,0.12)]"
                    : activeThreadId === thread.id
                      ? "border-[#ff8a5c]/35 bg-[#ff8a5c]/10 text-white shadow-[0_14px_36px_rgba(255,138,92,0.12)]"
                      : "border-white/8 bg-white/4 text-white/68 hover:bg-white/7 hover:text-white"
                }`}
                disabled={isLoadingThread || isSending}
                aria-busy={pendingThreadId === thread.id}
                onClick={() => void handleSelectThread(thread.id)}
              >
                {pendingThreadId === thread.id ? (
                  <SpinnerGap className="mt-0.5 size-4 shrink-0 animate-spin text-[#67e8c6]" />
                ) : (
                  <ChatCircleDots className="mt-0.5 size-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs leading-6">{thread.title}</p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/36">
                    {pendingThreadId === thread.id
                      ? "abrindo conversa"
                      : formatThreadDate(thread.updatedAt)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        <div ref={profileMenuRef} className="relative mt-6">
          {isProfileMenuOpen ? (
            <div className="absolute right-0 bottom-full left-0 z-10 mb-3 rounded-[1.35rem] border border-white/10 bg-[#081925]/95 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur">
              <button
                type="button"
                className="flex h-11 w-full items-center gap-3 rounded-[1rem] px-3 text-left text-sm text-white/76 transition hover:bg-white/8 hover:text-white"
                onClick={handleOpenSettings}
              >
                <GearSix className="size-4 text-[#67e8c6]" />
                Configuracoes
              </button>

              <button
                type="button"
                className="mt-1 flex h-11 w-full items-center gap-3 rounded-[1rem] px-3 text-left text-sm text-white/76 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => void handleLogout()}
                disabled={isLeaving}
              >
                {isLeaving ? (
                  <SpinnerGap className="size-4 animate-spin text-[#ffcf86]" />
                ) : (
                  <SignOut className="size-4 text-[#ffcf86]" />
                )}
                {isLeaving ? "Saindo..." : "Sair"}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-[1.6rem] border border-white/10 bg-white/6 p-4 text-left transition hover:bg-white/8"
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsProfileMenuOpen((current) => !current)}
          >
            <UserAvatar
              name={currentUser.name}
              avatarUrl={currentAvatarUrl}
              className="size-11 rounded-[1rem] border-white/16"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {currentUser.name}
              </p>
              <p className="truncate text-xs text-white/56">
                {currentUser.email}
              </p>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/70">
              <CaretDown
                className={`size-4 transition-transform ${
                  isProfileMenuOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </aside>

      <div
        className={`relative h-screen overflow-hidden transition-[padding] duration-300 ${
          isSidebarOpen ? "xl:pl-72" : "xl:pl-0"
        }`}
      >
        <header className="sticky top-0 z-10 border-b border-white/8 bg-[#071925]/34 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 py-4 pl-20 pr-4 sm:pl-24 sm:pr-6 xl:px-10">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#ffd166]">
                Casa Aurora
              </p>
              <p className="text-sm text-white/64">
                {activeThreadId
                  ? "Historico protegido e criptografado"
                  : "Seu espaco de conversa"}
              </p>
            </div>
          </div>
        </header>

        <section className="relative flex h-[calc(100vh-73px)] flex-col overflow-hidden">
          {isOpeningThread ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center px-4 py-8 sm:px-6 xl:px-10">
              <div className="absolute inset-0 bg-[#07131d]/72 backdrop-blur-md" />
              <div className="relative w-full max-w-3xl rounded-[2.2rem] border border-white/10 bg-[#081925]/72 p-6 shadow-[0_28px_120px_rgba(0,0,0,0.45)]">
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-[#67e8c6]">
                  <SpinnerGap className="size-4 animate-spin" />
                  carregando conversa
                </div>

                <div className="mt-6 space-y-4">
                  <div className="h-20 w-2/3 animate-pulse rounded-[1.6rem] border border-white/8 bg-white/6" />
                  <div className="ml-auto h-24 w-1/2 animate-pulse rounded-[1.6rem] border border-[#ff8a5c]/20 bg-[#ff8a5c]/10" />
                  <div className="h-28 w-4/5 animate-pulse rounded-[1.6rem] border border-white/8 bg-white/6" />
                </div>

                <p className="mt-6 text-sm leading-7 text-white/62">
                  Estamos recuperando o historico desta conversa para voce continuar de onde parou.
                </p>
              </div>
            </div>
          ) : null}

          {loadError ? (
            <div className="mx-auto mt-6 w-full max-w-4xl px-4 sm:px-6 xl:px-10">
              <div className="rounded-[1.4rem] border border-rose-300/22 bg-rose-300/10 px-5 py-4 text-sm text-rose-100">
                {loadError}
              </div>
            </div>
          ) : null}

          {hasMessages ? (
            <div className="flex min-h-0 flex-1 flex-col px-4 pt-8 sm:px-6 xl:px-10">
              <div className="min-h-0 flex-1 overflow-hidden">
                <div
                  ref={conversationViewportRef}
                  className="chat-scroll-surface scrollbar-hidden mx-auto h-full w-full max-w-5xl overflow-y-auto rounded-[2.2rem] border border-[#7cc8ff]/12 bg-[linear-gradient(180deg,rgba(7,25,37,0.94),rgba(10,28,39,0.98))] px-5 pb-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_90px_rgba(0,0,0,0.28)] sm:px-7"
                >
                  <div className="flex min-h-full flex-col gap-5 pt-6">
                    {visibleMessages.map((message) => (
                      <ChatMessageBubble key={message.id} message={message} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 pb-6 pt-4">{composer}</div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-10 text-center sm:px-6 xl:px-10">
              <div className="flex w-full flex-col items-center gap-8">
                <div className="space-y-6">
                  <Badge className="border-[#ffd166]/25 bg-[#ffd166]/12 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[#fff1cc]">
                    conversa inicial
                  </Badge>

                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-[#ffd166]">
                      bem-vindo de volta
                    </p>
                    <h1 className="mx-auto max-w-3xl text-4xl leading-[1.04] font-semibold text-white sm:text-5xl">
                      Oi, {firstName(currentUser.name)}. O que voce gostaria de colocar para fora hoje?
                    </h1>
                    <p className="mx-auto max-w-2xl text-sm leading-7 text-white/64 sm:text-base">
                      Sua conversa agora pode continuar de onde parou, com o
                      historico protegido no banco e pronto para ser recuperado.
                    </p>
                  </div>
                </div>

                <div className="w-full">{composer}</div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  {suggestionPrompts.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="rounded-full border border-[#7cc8ff]/12 bg-white/6 px-4 py-2 text-xs text-white/70 transition hover:border-[#67e8c6]/30 hover:bg-[#67e8c6]/10 hover:text-white"
                      onClick={() => setPrompt(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {isLoadingHistory ? (
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-white/42">
                    <SpinnerGap className="size-4 animate-spin text-[#ffd166]" />
                    carregando suas conversas
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {!hasMessages ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-10 hidden xl:block">
              <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 text-[11px] uppercase tracking-[0.28em] text-white/38">
                <Sparkle className="size-4 text-[#67e8c6]" />
                sidebar expansivel com historico real, protegido e pronto para continuar
              </div>
            </div>
          ) : null}
        </section>

        {isSettingsOpen ? (
          <SettingsPanel
            user={currentUser}
            avatarVersion={avatarVersion}
            onClose={handleCloseSettings}
            onPhotoSaved={handlePhotoSaved}
          />
        ) : null}
      </div>
    </main>
  );
}
