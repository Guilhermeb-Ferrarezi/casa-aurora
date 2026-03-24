import { NextResponse } from "next/server";
import { authError } from "@/lib/auth/responses";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    const response = authError("Voce ainda nao esta autenticado.", 401);
    clearSessionCookie(response);
    return response;
  }

  return NextResponse.json({ user });
}
