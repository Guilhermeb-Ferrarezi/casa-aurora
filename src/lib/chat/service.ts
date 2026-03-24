import type { AuthUser } from "@/lib/auth/types";
import { buildAttachmentOnlyThreadTitle } from "@/lib/chat/attachments";
import {
  CHAT_CONTEXT_LIMIT,
  CHAT_SYSTEM_PROMPT,
  GROQ_MODEL,
  GROQ_VISION_MODEL,
} from "@/lib/chat/constants";
import { decryptChatText, encryptChatText } from "@/lib/chat/encryption";
import type {
  ChatAttachmentItem,
  ChatBootstrapResponse,
  ChatMessageStreamEvent,
  ChatThreadResponse,
  ChatThreadSummary,
} from "@/lib/chat/types";
import { prisma } from "@/lib/prisma";
import {
  deleteChatAttachmentObjects,
  getChatAttachmentDataUrl,
  uploadChatAttachment,
} from "@/lib/storage/r2";

const IMAGE_ONLY_FALLBACK_PROMPT =
  "A pessoa enviou uma imagem sem texto. Observe o que aparece nela e responda com acolhimento em portugues do Brasil.";

const chatAttachmentSelect = {
  id: true,
  storageKey: true,
  mimeType: true,
  originalName: true,
  sizeBytes: true,
  createdAt: true,
} as const;

const chatMessageSelect = {
  id: true,
  role: true,
  contentEncrypted: true,
  createdAt: true,
  attachments: {
    orderBy: {
      createdAt: "asc",
    },
    select: chatAttachmentSelect,
  },
} as const;

type ThreadEntity = {
  id: string;
  titleEncrypted: string;
  updatedAt: Date;
};

type AttachmentEntity = {
  id: string;
  storageKey: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  createdAt: Date;
};

type MessageEntity = {
  id: string;
  role: "USER" | "ASSISTANT";
  contentEncrypted: string;
  createdAt: Date;
  attachments: AttachmentEntity[];
};

type GroqMessageContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    };

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string | GroqMessageContentPart[];
};

function firstName(name: string) {
  return name.trim().split(" ")[0] || name;
}

function toThreadSummary(thread: ThreadEntity): ChatThreadSummary {
  return {
    id: thread.id,
    title: decryptChatText(thread.titleEncrypted),
    updatedAt: thread.updatedAt.toISOString(),
  };
}

function toAttachmentItem(attachment: AttachmentEntity): ChatAttachmentItem {
  return {
    id: attachment.id,
    name: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: `/api/chat/attachments/${attachment.id}`,
  };
}

function toMessageItem(message: MessageEntity) {
  return {
    id: message.id,
    role: message.role === "USER" ? "user" : "assistant",
    content: decryptChatText(message.contentEncrypted),
    attachments: message.attachments.map(toAttachmentItem),
    createdAt: message.createdAt.toISOString(),
  } as const;
}

function buildThreadTitle(content: string, attachmentCount: number) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return attachmentCount > 0
      ? buildAttachmentOnlyThreadTitle(attachmentCount)
      : "Nova conversa";
  }

  if (normalized.length <= 54) {
    return normalized;
  }

  return `${normalized.slice(0, 51)}...`;
}

function buildAssistantFallback(name: string) {
  return `Estou aqui com voce, ${firstName(
    name,
  )}. No momento eu nao consegui acessar a resposta completa, mas podemos continuar com calma se voce quiser me contar mais um pouco.`;
}

async function getThreadEntity(userId: string, threadId: string) {
  return prisma.chatThread.findFirst({
    where: {
      id: threadId,
      userId,
    },
    select: {
      id: true,
      titleEncrypted: true,
      updatedAt: true,
    },
  });
}

export async function getThreadSummaries(userId: string) {
  const threads = await prisma.chatThread.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      titleEncrypted: true,
      updatedAt: true,
    },
  });

  return threads.map(toThreadSummary);
}

export async function getThreadMessages(
  userId: string,
  threadId: string,
): Promise<ChatThreadResponse | null> {
  const thread = await prisma.chatThread.findFirst({
    where: {
      id: threadId,
      userId,
    },
    select: {
      id: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
        select: chatMessageSelect,
      },
    },
  });

  if (!thread) {
    return null;
  }

  return {
    threadId: thread.id,
    messages: thread.messages.map(toMessageItem),
  };
}

export async function getChatBootstrap(
  userId: string,
  preferredThreadId?: string | null,
): Promise<ChatBootstrapResponse> {
  const threads = await getThreadSummaries(userId);

  if (threads.length === 0) {
    return {
      threads,
      activeThreadId: null,
      messages: [],
    };
  }

  const selectedThreadId =
    preferredThreadId && threads.some((thread) => thread.id === preferredThreadId)
      ? preferredThreadId
      : threads[0].id;

  const selectedThread = await getThreadMessages(userId, selectedThreadId);

  return {
    threads,
    activeThreadId: selectedThread?.threadId ?? null,
    messages: selectedThread?.messages ?? [],
  };
}

async function buildGroqUserContent(
  content: string,
  attachments: AttachmentEntity[],
): Promise<string | GroqMessageContentPart[]> {
  if (attachments.length === 0) {
    return content;
  }

  const signedUrls = await Promise.all(
    attachments.map((attachment) =>
      getChatAttachmentDataUrl(attachment.storageKey, attachment.mimeType),
    ),
  );
  const parts: GroqMessageContentPart[] = [
    {
      type: "text",
      text: content || IMAGE_ONLY_FALLBACK_PROMPT,
    },
    ...signedUrls.map((url) => ({
      type: "image_url" as const,
      image_url: {
        url,
      },
    })),
  ];

  return parts;
}

async function buildGroqMessages(threadId: string, userName: string) {
  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: {
      createdAt: "desc",
    },
    take: CHAT_CONTEXT_LIMIT,
    select: {
      role: true,
      contentEncrypted: true,
      attachments: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          storageKey: true,
          mimeType: true,
          originalName: true,
          sizeBytes: true,
          id: true,
          createdAt: true,
        },
      },
    },
  });

  const reversedMessages = [...messages].reverse();
  const requiresVisionModel = reversedMessages.some(
    (message) => message.attachments.length > 0,
  );
  const mappedMessages = await Promise.all(
    reversedMessages.map(async (message) => {
      const decryptedContent = decryptChatText(message.contentEncrypted);

      return {
        role:
          message.role === "USER"
            ? ("user" as const)
            : ("assistant" as const),
        content:
          message.role === "USER"
            ? await buildGroqUserContent(decryptedContent, message.attachments)
            : decryptedContent,
      };
    }),
  );

  return {
    requiresVisionModel,
    messages: [
      {
        role: "system" as const,
        content: `${CHAT_SYSTEM_PROMPT.trim()}\nChame a pessoa de ${firstName(
          userName,
        )} apenas quando isso soar natural.`,
      },
      ...mappedMessages,
    ] satisfies GroqMessage[],
  };
}

async function buildGroqRequestBody(threadId: string, userName: string) {
  const { messages, requiresVisionModel } = await buildGroqMessages(
    threadId,
    userName,
  );

  return {
    model: requiresVisionModel ? GROQ_VISION_MODEL : GROQ_MODEL,
    temperature: 0.7,
    max_tokens: 500,
    messages,
  };
}

async function requestGroqReply(threadId: string, user: AuthUser) {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    return buildAssistantFallback(user.name);
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(await buildGroqRequestBody(threadId, user.name)),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha no Groq: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Resposta do Groq veio vazia.");
  }

  return content;
}

export function createChatEventChunk(event: ChatMessageStreamEvent) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function createUserChatMessage(
  user: AuthUser,
  content: string,
  threadId?: string | null,
  attachments: File[] = [],
) {
  const normalizedContent = content.trim();

  let thread = threadId ? await getThreadEntity(user.id, threadId) : null;
  const isNewThread = !thread;

  if (!thread) {
    thread = await prisma.chatThread.create({
      data: {
        userId: user.id,
        titleEncrypted: encryptChatText(
          buildThreadTitle(normalizedContent, attachments.length),
        ),
      },
      select: {
        id: true,
        titleEncrypted: true,
        updatedAt: true,
      },
    });
  }

  let uploadedAttachments: Array<Awaited<ReturnType<typeof uploadChatAttachment>>> =
    [];

  try {
    uploadedAttachments = await Promise.all(
      attachments.map((file) =>
        uploadChatAttachment({
          userId: user.id,
          threadId: thread.id,
          file,
        }),
      ),
    );

    const result = await prisma.$transaction(async (transaction) => {
      const userMessage = await transaction.chatMessage.create({
        data: {
          threadId: thread.id,
          role: "USER",
          contentEncrypted: encryptChatText(normalizedContent),
          attachments:
            uploadedAttachments.length > 0
              ? {
                  create: uploadedAttachments,
                }
              : undefined,
        },
        select: {
          id: true,
          createdAt: true,
          attachments: {
            orderBy: {
              createdAt: "asc",
            },
            select: chatAttachmentSelect,
          },
        },
      });

      const nextThread = isNewThread
        ? thread
        : await transaction.chatThread.update({
            where: { id: thread.id },
            data: {
              updatedAt: new Date(),
            },
            select: {
              id: true,
              titleEncrypted: true,
              updatedAt: true,
            },
          });

      return {
        userMessage,
        thread: nextThread,
      };
    });

    return {
      threadId: result.thread.id,
      thread: toThreadSummary(result.thread),
      userMessage: {
        id: result.userMessage.id,
        role: "user" as const,
        content: normalizedContent,
        attachments: result.userMessage.attachments.map(toAttachmentItem),
        createdAt: result.userMessage.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (uploadedAttachments.length > 0) {
      await deleteChatAttachmentObjects(
        uploadedAttachments.map((attachment) => attachment.storageKey),
      );
    }

    if (isNewThread) {
      await prisma.chatThread
        .delete({
          where: { id: thread.id },
        })
        .catch(() => null);
    }

    throw error;
  }
}

function extractStreamEventData(rawEvent: string) {
  const data = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
    .trim();

  return data || null;
}

async function requestGroqReplyStream(
  threadId: string,
  user: AuthUser,
  onChunk: (chunk: string) => void,
) {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    const fallback = buildAssistantFallback(user.name);
    onChunk(fallback);
    return fallback;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      ...(await buildGroqRequestBody(threadId, user.name)),
      stream: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha no Groq: ${response.status} ${detail}`);
  }

  if (!response.body) {
    throw new Error("Resposta em stream do Groq veio sem corpo.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();

    buffer += decoder.decode(value, { stream: !done });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const data = extractStreamEventData(rawEvent);

      if (!data || data === "[DONE]") {
        continue;
      }

      const parsed = JSON.parse(data) as {
        choices?: Array<{
          delta?: {
            content?: string;
          };
        }>;
      };

      const chunk = parsed.choices?.[0]?.delta?.content;

      if (!chunk) {
        continue;
      }

      content += chunk;
      onChunk(chunk);
    }

    if (done) {
      break;
    }
  }

  const trailingEvent = extractStreamEventData(buffer);

  if (trailingEvent && trailingEvent !== "[DONE]") {
    const parsed = JSON.parse(trailingEvent) as {
      choices?: Array<{
        delta?: {
          content?: string;
        };
      }>;
    };

    const chunk = parsed.choices?.[0]?.delta?.content;

    if (chunk) {
      content += chunk;
      onChunk(chunk);
    }
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error("Resposta do Groq veio vazia.");
  }

  return normalizedContent;
}

export async function generateAssistantReply(
  threadId: string,
  user: AuthUser,
  onChunk: (chunk: string) => void,
) {
  try {
    return await requestGroqReplyStream(threadId, user, onChunk);
  } catch (error) {
    console.error("Falha ao gerar resposta do chat:", error);
    const fallback =
      "Eu nao consegui responder por completo agora, mas continuo aqui com voce. Se quiser, tente novamente em instantes ou me conte isso de outro jeito.";
    onChunk(fallback);
    return fallback;
  }
}

export async function finalizeAssistantReply(
  threadId: string,
  assistantReply: string,
) {
  const assistantMessage = await prisma.chatMessage.create({
    data: {
      threadId,
      role: "ASSISTANT",
      contentEncrypted: encryptChatText(assistantReply),
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  const thread = await prisma.chatThread.update({
    where: { id: threadId },
    data: {
      updatedAt: new Date(),
    },
    select: {
      id: true,
      titleEncrypted: true,
      updatedAt: true,
    },
  });

  return {
    activeThreadId: thread.id,
    thread: toThreadSummary(thread),
    assistantMessage: {
      id: assistantMessage.id,
      role: "assistant" as const,
      content: assistantReply,
      attachments: [],
      createdAt: assistantMessage.createdAt.toISOString(),
    },
  };
}

export async function getChatAttachmentAccess(
  userId: string,
  attachmentId: string,
) {
  return prisma.chatMessageAttachment.findFirst({
    where: {
      id: attachmentId,
      message: {
        thread: {
          userId,
        },
      },
    },
    select: {
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
    },
  });
}

export async function sendChatMessage(
  user: AuthUser,
  content: string,
  threadId?: string | null,
  attachments: File[] = [],
) {
  const { threadId: nextThreadId } = await createUserChatMessage(
    user,
    content,
    threadId,
    attachments,
  );
  let assistantReply: string;

  try {
    assistantReply = await requestGroqReply(nextThreadId, user);
  } catch (error) {
    console.error("Falha ao gerar resposta do chat:", error);
    assistantReply =
      "Eu nao consegui responder por completo agora, mas continuo aqui com voce. Se quiser, tente novamente em instantes ou me conte isso de outro jeito.";
  }

  return finalizeAssistantReply(nextThreadId, assistantReply);
}
