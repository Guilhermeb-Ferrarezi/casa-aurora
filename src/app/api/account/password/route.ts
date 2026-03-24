import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { authError, authValidationError } from "@/lib/auth/responses";
import { changePasswordSchema } from "@/lib/auth/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import type { PasswordUpdateResponse } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return authError("Voce precisa entrar para alterar sua senha.", 401);
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return authError("Envie um corpo JSON valido para continuar.", 400);
    }

    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return authValidationError(parsed.error);
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!currentUser) {
      return authError("Nao foi possivel encontrar sua conta agora.", 404);
    }

    const currentPasswordMatches = await bcrypt.compare(
      parsed.data.currentPassword,
      currentUser.passwordHash,
    );

    if (!currentPasswordMatches) {
      return authError("Sua senha atual nao confere.", 400, {
        currentPassword: ["A senha atual informada nao confere."],
      });
    }

    const isSamePassword = await bcrypt.compare(
      parsed.data.newPassword,
      currentUser.passwordHash,
    );

    if (isSamePassword) {
      return authError("Escolha uma senha diferente da atual.", 400, {
        newPassword: ["Use uma senha diferente da atual."],
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { passwordHash },
    });

    return NextResponse.json<PasswordUpdateResponse>({
      message: "Senha atualizada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao atualizar senha:", error);
    return authError("Nao foi possivel atualizar sua senha agora.", 500);
  }
}
