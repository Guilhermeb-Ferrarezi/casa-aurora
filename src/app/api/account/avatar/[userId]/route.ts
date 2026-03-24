import { authError } from "@/lib/auth/responses";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserAvatarObject } from "@/lib/storage/r2";

export const runtime = "nodejs";

function avatarResponseHeaders(contentType?: string, contentLength?: number | null) {
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
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return authError("Voce precisa entrar para acessar esta imagem.", 401);
    }

    const { userId } = await context.params;

    if (userId !== user.id) {
      return new Response(null, {
        status: 403,
        headers: avatarResponseHeaders(),
      });
    }

    const avatar = await getUserAvatarObject(user.id);

    if (!avatar) {
      return new Response(null, {
        status: 404,
        headers: avatarResponseHeaders(),
      });
    }

    return new Response(avatar.body.transformToWebStream(), {
      headers: avatarResponseHeaders(avatar.contentType, avatar.contentLength),
    });
  } catch (error) {
    console.error("Erro ao carregar avatar:", error);

    return new Response(null, {
      status: 500,
      headers: avatarResponseHeaders(),
    });
  }
}
