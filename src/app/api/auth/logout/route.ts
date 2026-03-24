import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({
    message: "Sessao encerrada com sucesso.",
  });

  clearSessionCookie(response);

  return response;
}
