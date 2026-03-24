import bcrypt from "bcryptjs"
import { NextResponse } from "next/server";
import { authError, authValidationError } from "@/lib/auth/responses";
import { registerSchema } from "@/lib/auth/schemas";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { publicUserSelect, toAuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return authError("Envie um corpo JSON valido para continuar.", 400);
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return authValidationError(parsed.error);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });

    if (existingUser) {
      return authError("Ja existe uma conta com este e-mail.", 409, {
        email: ["Este e-mail ja esta em uso."],
      });
    }

    const passwordHash = parsed.data.password
    const createdUser = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
      },
      select: publicUserSelect,
    });
    const user = toAuthUser(createdUser);

    const token = await createSessionToken(user);
    const response = NextResponse.json(
      {
        user,
        message: "Cadastro concluido com sucesso.",
      },
      { status: 201 },
    );

    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("Erro ao cadastrar usuario:", error);
    return authError("Nao foi possivel concluir seu cadastro agora.", 500);
  }
}
