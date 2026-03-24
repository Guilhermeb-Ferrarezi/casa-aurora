import { NextResponse } from "next/server";
import { authError } from "@/lib/auth/responses";
import { getCurrentUser } from "@/lib/auth/session";
import { getChatBootstrap } from "@/lib/chat/service";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return authError("Voce precisa entrar para acessar o chat.", 401);
    }

    const data = await getChatBootstrap(user.id);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro ao carregar bootstrap do chat:", error);
    return authError("Nao foi possivel carregar seu historico agora.", 500);
  }
}
