import { z } from "zod";
import { CHAT_MESSAGE_MAX_ATTACHMENTS } from "@/lib/chat/attachments";

export const sendChatMessageSchema = z.object({
  threadId: z.string().cuid().optional().nullable(),
  content: z
    .string()
    .trim()
    .max(4000, "Use uma mensagem com ate 4000 caracteres.")
    .default(""),
  attachmentCount: z
    .number()
    .int()
    .min(0)
    .max(
      CHAT_MESSAGE_MAX_ATTACHMENTS,
      `Voce pode enviar ate ${CHAT_MESSAGE_MAX_ATTACHMENTS} imagens por mensagem.`,
    ),
}).superRefine((value, context) => {
  if (!value.content && value.attachmentCount === 0) {
    context.addIssue({
      code: "custom",
      path: ["content"],
      message: "Escreva algo ou envie uma imagem para continuar.",
    });
  }
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
