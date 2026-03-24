import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { authError, authValidationError } from "@/lib/auth/responses";
import { loginSchema } from "@/lib/auth/schemas";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { publicUserSelect, toAuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return authError("Envie um corpo JSON valido para continuar.", 400);
    }

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return authValidationError(parsed.error);
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        ...publicUserSelect,
        passwordHash: true,
      },
    });

    if (!user) {
      return authError("Credenciais invalidas.", 401, {
        email: ["Nao encontramos uma conta com este e-mail."],
      });
    }

    const passwordMatches = await bcrypt.compare(
      parsed.data.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return authError("Credenciais invalidas.", 401, {
        password: ["A senha informada nao confere."],
      });
    }

    const safeUser = toAuthUser({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    const token = await createSessionToken(safeUser);
    const response = NextResponse.json({
      user: safeUser,
      message: "Login realizado com sucesso.",
    });

    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("Erro ao autenticar usuario:", error);
    return authError("Nao foi possivel fazer login agora.", 500);
  }
}
