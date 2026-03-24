export const CHAT_MESSAGE_MAX_ATTACHMENTS = 5;
export const CHAT_ATTACHMENT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_TOTAL_BYTES = Math.floor(2.5 * 1024 * 1024);
export const CHAT_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const CHAT_ATTACHMENT_ACCEPT = CHAT_ATTACHMENT_MIME_TYPES.join(",");

export function validateChatAttachmentFile(file: {
  size: number;
  type: string;
}) {
  if (!CHAT_ATTACHMENT_MIME_TYPES.includes(file.type as (typeof CHAT_ATTACHMENT_MIME_TYPES)[number])) {
    return "Envie imagens JPG, PNG ou WebP.";
  }

  if (file.size > CHAT_ATTACHMENT_MAX_FILE_SIZE_BYTES) {
    return "Cada imagem precisa ter no maximo 5 MB.";
  }

  return null;
}

export function validateChatAttachmentTotalSize(totalSizeBytes: number) {
  if (totalSizeBytes > CHAT_ATTACHMENT_MAX_TOTAL_BYTES) {
    return "Para analisar imagens no chat, envie ate 2.5 MB somando todos os anexos.";
  }

  return null;
}

export function buildAttachmentOnlyThreadTitle(attachmentCount: number) {
  return attachmentCount === 1 ? "Imagem enviada" : `${attachmentCount} imagens enviadas`;
}
