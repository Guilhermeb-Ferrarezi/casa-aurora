import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_TOKEN_MAX_AGE, AUTH_TOKEN_TTL } from "@/lib/auth/constants";
import { publicUserSelect, toAuthUser, type AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

type SessionPayload = {
  email: string;
};

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET?.trim();

  if (secret) {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV !== "production") {
    return new TextEncoder().encode("dev-only-secret-change-me");
  }

  throw new Error("AUTH_JWT_SECRET nao configurado.");
}

export async function createSessionToken(user: AuthUser) {
  return new SignJWT({ email: user.email } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(AUTH_TOKEN_TTL)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify<SessionPayload>(token, getJwtSecret(), {
    algorithms: ["HS256"],
  });

  if (!payload.sub || !payload.email) {
    throw new Error("Token de sessao invalido.");
  }

  return payload;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_TOKEN_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifySessionToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: publicUserSelect,
    });

    return user ? toAuthUser(user) : null;
  } catch {
    return null;
  }
}
