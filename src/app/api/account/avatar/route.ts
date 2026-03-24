import { NextResponse } from "next/server";
import { authError } from "@/lib/auth/responses";
import { getCurrentUser } from "@/lib/auth/session";
import type { AvatarUploadResponse } from "@/lib/auth/types";
import { validateAvatarFile, uploadUserAvatar } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return authError("Voce precisa entrar para atualizar sua foto.", 401);
    }

    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return authError("Envie uma imagem valida para continuar.", 400);
    }

    const avatar = formData.get("avatar");

    if (!(avatar instanceof File)) {
      return authError("Escolha uma imagem para continuar.", 400, {
        avatar: ["Selecione uma imagem antes de salvar."],
      });
    }

    const validationMessage = validateAvatarFile(avatar);

    if (validationMessage) {
      return authError(validationMessage, 400, {
        avatar: [validationMessage],
      });
    }

    await uploadUserAvatar({
      userId: user.id,
      file: avatar,
    });

    return NextResponse.json<AvatarUploadResponse>({
      user,
      message: "Foto atualizada com sucesso.",
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao atualizar avatar:", error);
    return authError("Nao foi possivel salvar sua foto agora.", 500);
  }
}
