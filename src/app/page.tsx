import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatHome } from "@/components/home/chat-home";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Inicio | Casa Aurora",
  description: "Uma home em formato de chat para continuar sua conversa com calma.",
};

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  return <ChatHome user={user} />;
}
