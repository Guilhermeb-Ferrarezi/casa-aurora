import { NextResponse } from "next/server";
import { authError } from "@/lib/auth/responses";
import { getCurrentUser } from "@/lib/auth/session";
import { getThreadMessages } from "@/lib/chat/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return authError("Voce precisa entrar para acessar esta conversa.", 401);
    }

    const { threadId } = await context.params;
    const data = await getThreadMessages(user.id, threadId);

    if (!data) {
      return authError("Conversa nao encontrada.", 404);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro ao carregar conversa:", error);
    return authError("Nao foi possivel carregar esta conversa agora.", 500);
  }
}
