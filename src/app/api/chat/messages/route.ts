import { NextResponse } from "next/server";
import { authError, authValidationError } from "@/lib/auth/responses";
import { getCurrentUser } from "@/lib/auth/session";
import {
  validateChatAttachmentFile,
  validateChatAttachmentTotalSize,
} from "@/lib/chat/attachments";
import { sendChatMessageSchema } from "@/lib/chat/schemas";
import {
  createChatEventChunk,
  createUserChatMessage,
  finalizeAssistantReply,
  generateAssistantReply,
} from "@/lib/chat/service";
import type { ChatMessageStreamEvent } from "@/lib/chat/types";

export const runtime = "nodejs";

function getFormDataString(
  value: FormDataEntryValue | null,
  fallback = "",
) {
  return typeof value === "string" ? value : fallback;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return authError("Voce precisa entrar para conversar.", 401);
    }

    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return authError("Envie uma mensagem valida para continuar.", 400);
    }

    const attachments = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const body = {
      threadId: getFormDataString(formData.get("threadId")) || null,
      content: getFormDataString(formData.get("content")),
      attachmentCount: attachments.length,
    };

    const parsed = sendChatMessageSchema.safeParse(body);

    if (!parsed.success) {
      return authValidationError(parsed.error);
    }

    for (const attachment of attachments) {
      const validationMessage = validateChatAttachmentFile(attachment);

      if (validationMessage) {
        return authError(validationMessage, 400, {
          attachments: [validationMessage],
        });
      }
    }

    const totalAttachmentSize = attachments.reduce(
      (total, attachment) => total + attachment.size,
      0,
    );
    const totalSizeValidationMessage =
      validateChatAttachmentTotalSize(totalAttachmentSize);

    if (totalSizeValidationMessage) {
      return authError(totalSizeValidationMessage, 400, {
        attachments: [totalSizeValidationMessage],
      });
    }

    const thread = await createUserChatMessage(
      user,
      parsed.data.content,
      parsed.data.threadId,
      attachments,
    );

    const stream = new ReadableStream({
      async start(controller) {
        function enqueue(event: ChatMessageStreamEvent) {
          controller.enqueue(createChatEventChunk(event));
        }

        try {
          enqueue({
            type: "thread",
            activeThreadId: thread.threadId,
            thread: thread.thread,
          });

          const assistantReply = await generateAssistantReply(
            thread.threadId,
            user,
            (content) => {
              enqueue({
                type: "chunk",
                content,
              });
            },
          );

          const data = await finalizeAssistantReply(
            thread.threadId,
            assistantReply,
          );

          enqueue({
            type: "done",
            data: {
              ...data,
              userMessage: thread.userMessage,
            },
          });
        } catch (error) {
          console.error("Erro ao transmitir mensagem:", error);
          enqueue({
            type: "error",
            message: "Nao foi possivel enviar sua mensagem agora.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return authError("Nao foi possivel enviar sua mensagem agora.", 500);
  }
}
