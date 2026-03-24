import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Acesso | Casa Aurora",
  description:
    "Entrar ou criar uma conta para acessar a experiencia inicial da Casa Aurora.",
};

export default async function AuthPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return <AuthPanel initialUser={user} />;
}
