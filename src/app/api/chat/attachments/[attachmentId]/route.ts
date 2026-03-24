import { authError } from "@/lib/auth/responses";
import { getCurrentUser } from "@/lib/auth/session";
import { getChatAttachmentAccess } from "@/lib/chat/service";
import { getChatAttachmentObject } from "@/lib/storage/r2";

export const runtime = "nodejs";

function attachmentResponseHeaders(
  contentType?: string,
  contentLength?: number | null,
) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
  });

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (contentLength) {
    headers.set("Content-Length", String(contentLength));
  }

  return headers;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return authError("Voce precisa entrar para acessar esta imagem.", 401);
    }

    const { attachmentId } = await context.params;
    const attachment = await getChatAttachmentAccess(user.id, attachmentId);

    if (!attachment) {
      return new Response(null, {
        status: 404,
        headers: attachmentResponseHeaders(),
      });
    }

    const object = await getChatAttachmentObject(attachment.storageKey);

    if (!object) {
      return new Response(null, {
        status: 404,
        headers: attachmentResponseHeaders(),
      });
    }

    return new Response(object.body.transformToWebStream(), {
      headers: attachmentResponseHeaders(
        object.contentType || attachment.mimeType,
        object.contentLength ?? attachment.sizeBytes,
      ),
    });
  } catch (error) {
    console.error("Erro ao carregar anexo do chat:", error);

    return new Response(null, {
      status: 500,
      headers: attachmentResponseHeaders(),
    });
  }
}
