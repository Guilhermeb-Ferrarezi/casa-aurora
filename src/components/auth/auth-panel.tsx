"use client";

import type { ComponentProps, FormEvent } from "react";
import { startTransition, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import {
  CheckCircle,
  Eye,
  EyeSlash,
  Fingerprint,
  LockKey,
  ShootingStar,
  Sparkle,
  UserCirclePlus,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type {
  AuthErrorResponse,
  AuthResponse,
  AuthUser,
} from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type AuthTab = "login" | "register";
type ActiveAction = "login" | "register" | "logout" | null;
type FormErrors = Record<string, string[] | undefined> | undefined;
type PasswordFieldKey = "login" | "register" | "confirm";

type FormStatus = {
  scope: AuthTab;
  message: string;
  fieldErrors?: FormErrors;
};

type LoginFormState = {
  email: string;
  password: string;
};

type RegisterFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialLoginState: LoginFormState = {
  email: "",
  password: "",
};

const initialRegisterState: RegisterFormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const initialPasswordVisibility: Record<PasswordFieldKey, boolean> = {
  login: false,
  register: false,
  confirm: false,
};

const authInputClassName =
  "h-12 rounded-[1.2rem] border-white/12 bg-[#0c2633]/55 px-4 text-lg md:text-lg text-white placeholder:text-[#d7e9f1]/30 focus-visible:border-[#67e8c6]/55 focus-visible:ring-[#67e8c6]/35";

function getApiError(error: unknown, fallbackMessage: string): FormStatus {
  const axiosError = error as AxiosError<AuthErrorResponse>;

  return {
    scope: "login",
    message: axiosError.response?.data.message || fallbackMessage,
    fieldErrors: axiosError.response?.data.fieldErrors,
  };
}

function FieldMessage({
  errors,
  field,
}: {
  errors?: FormErrors;
  field: string;
}) {
  const message = errors?.[field]?.[0];

  if (!message) {
    return null;
  }

  return <p className="text-[11px] text-rose-300">{message}</p>;
}

function PasswordField({
  isVisible,
  onToggleVisibility,
  toggleLabel = "senha",
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & {
  isVisible: boolean;
  onToggleVisibility: () => void;
  toggleLabel?: string;
}) {
  return (
    <div className="relative">
      <Input
        type={isVisible ? "text" : "password"}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[1.2rem] text-white/46 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67e8c6]/65"
        aria-label={isVisible ? `Ocultar ${toggleLabel}` : `Mostrar ${toggleLabel}`}
        aria-pressed={isVisible}
      >
        {isVisible ? (
          <EyeSlash className="size-5" weight="regular" />
        ) : (
          <Eye className="size-5" weight="regular" />
        )}
      </button>
    </div>
  );
}

export function AuthPanel({ initialUser }: { initialUser: AuthUser | null }) {
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialUser);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [status, setStatus] = useState<FormStatus | null>(null);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLoginState);
  const [passwordVisibility, setPasswordVisibility] = useState(
    initialPasswordVisibility,
  );
  const [registerForm, setRegisterForm] =
    useState<RegisterFormState>(initialRegisterState);

  const isBusy = activeAction !== null;
  const currentErrors = status?.scope === activeTab ? status.fieldErrors : undefined;

  const highlights = useMemo(
    () => [
      "Seu tempo importa por aqui.",
      "Cada passo pode comecar com calma.",
      "Um espaco pensado para acolher sem pressa.",
    ],
    [],
  );

  function resetPasswordVisibility() {
    setPasswordVisibility({ ...initialPasswordVisibility });
  }

  function togglePasswordVisibility(field: PasswordFieldKey) {
    setPasswordVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }));
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveAction("login");
    setStatus(null);

    try {
      const { data } = await api.post<AuthResponse>("/api/auth/login", loginForm);

      setCurrentUser(data.user);
      setLoginForm(initialLoginState);
      resetPasswordVisibility();
      setStatus(null);
      window.location.replace("/");
    } catch (error) {
      setStatus({
        ...getApiError(error, "Nao foi possivel concluir o login."),
        scope: "login",
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveAction("register");
    setStatus(null);

    try {
      const { data } = await api.post<AuthResponse>(
        "/api/auth/register",
        registerForm,
      );

      setCurrentUser(data.user);
      setRegisterForm(initialRegisterState);
      resetPasswordVisibility();
      setStatus(null);
      window.location.replace("/");
    } catch (error) {
      setStatus({
        ...getApiError(error, "Nao foi possivel concluir o cadastro."),
        scope: "register",
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleLogout() {
    setActiveAction("logout");

    try {
      await api.post("/api/auth/logout");
      startTransition(() => {
        setCurrentUser(null);
        setStatus(null);
        setActiveTab("login");
      });
    } catch (error) {
      setStatus({
        ...getApiError(error, "Nao foi possivel sair da sessao."),
        scope: "login",
      });
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,138,92,0.32),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(103,232,198,0.18),_transparent_30%),linear-gradient(140deg,_#07131d_0%,_#0d2430_48%,_#0b1520_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 auth-grid opacity-50" />
      <div className="pointer-events-none absolute -left-24 top-24 size-72 rounded-full bg-[#ff8a5c]/24 blur-3xl animate-drift" />
      <div className="pointer-events-none absolute right-0 top-0 size-80 rounded-full bg-[#ffd166]/18 blur-3xl animate-drift-slow" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 size-96 rounded-full bg-[#67e8c6]/16 blur-3xl animate-drift" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="flex flex-col justify-between rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_30px_100px_rgba(3,10,20,0.38)] backdrop-blur xl:p-10">
            <div className="space-y-6">
              <Badge className="w-fit border-[#ffd166]/25 bg-[#ffd166]/12 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[#fff1cc]">
                Casa Aurora
              </Badge>

              <div className="max-w-2xl space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-[#ffd166]">
                  um lugar para respirar
                </p>
                <h1 className="max-w-xl text-4xl leading-[1.05] font-semibold text-white sm:text-5xl">
                  Entre quando quiser. Este espaco foi feito para te receber bem.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-white/72 sm:text-base">
                  Crie sua conta ou volte para o seu canto com tranquilidade.
                  Aqui, o primeiro passo e simples: chegar, respirar e seguir no
                  seu ritmo.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-white/10 bg-[#071925]/46 p-4 text-white transition-transform duration-500 hover:-translate-y-1"
                >
                  <Sparkle className="mb-4 size-5 text-[#67e8c6]" weight="fill" />
                  <p className="text-xs leading-6 text-white/78">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.24em] text-white/52">
              <span className="rounded-full border border-white/10 px-3 py-2">
                acolhimento
              </span>
              <span className="rounded-full border border-white/10 px-3 py-2">
                escuta
              </span>
              <span className="rounded-full border border-white/10 px-3 py-2">
                presenca
              </span>
              <span className="rounded-full border border-white/10 px-3 py-2">
                leveza
              </span>
            </div>
          </section>

          <Card className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#081925]/82 py-0 text-white shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff8a5c] to-[#67e8c6]" />
            <CardHeader className="gap-3 px-6 pt-6 sm:px-8 sm:pt-8">
              <Badge
                variant="outline"
                className="w-fit border-white/12 bg-white/8 text-[10px] uppercase tracking-[0.24em] text-white/78"
              >
                Sua chegada
              </Badge>
              <CardTitle className="text-2xl text-white">
                {currentUser ? "Que bom te ver por aqui." : "Entre e fique a vontade."}
              </CardTitle>
              <CardDescription className="max-w-md text-sm leading-7 text-white/62">
                {currentUser
                  ? "Seu acesso esta ativo neste navegador e o seu espaco continua pronto para quando voce quiser voltar."
                  : "Escolha a forma mais confortavel para comecar. Em poucos instantes, seu espaco ja estara pronto."}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
              {currentUser ? (
                <div className="animate-in fade-in-0 zoom-in-95 space-y-5 rounded-[1.5rem] border border-[#67e8c6]/25 bg-[#67e8c6]/10 p-5 duration-500">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[#c9fff0]">
                        autenticado
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        {currentUser.name}
                      </h2>
                      <p className="mt-1 text-sm text-white/70">{currentUser.email}</p>
                    </div>
                    <CheckCircle className="size-8 text-[#67e8c6]" weight="fill" />
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="grid gap-3 text-xs leading-6 text-white/72 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-white/10 bg-[#071925]/40 p-4">
                      <Fingerprint className="mb-3 size-5 text-[#ffd166]" />
                      Seu acesso ja foi reconhecido com tranquilidade.
                    </div>
                    <div className="rounded-[1.25rem] border border-white/10 bg-[#071925]/40 p-4">
                      <LockKey className="mb-3 size-5 text-[#67e8c6]" />
                      Quando voce voltar, este espaco continua pronto para te receber.
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    className="w-full rounded-[1.2rem] bg-[linear-gradient(135deg,_#e8fff6,_#ffd166)] text-[#081925] hover:brightness-105"
                    onClick={handleLogout}
                    disabled={isBusy}
                  >
                    {activeAction === "logout" ? "Encerrando..." : "Sair da sessao"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid h-14 w-full grid-cols-2 rounded-[1.35rem] border border-white/10 bg-white/8 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("login");
                        resetPasswordVisibility();
                        setStatus(null);
                      }}
                      className={`h-full rounded-[1rem] border-0 text-sm transition-all ${
                        activeTab === "login"
                          ? "bg-[linear-gradient(135deg,_#ffd166,_#ff8a5c)] text-[#081925] shadow-[0_12px_30px_rgba(255,138,92,0.22)]"
                          : "text-white/62 hover:bg-white/6 hover:text-white"
                      }`}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("register");
                        resetPasswordVisibility();
                        setStatus(null);
                      }}
                      className={`h-full rounded-[1rem] border-0 text-sm transition-all ${
                        activeTab === "register"
                          ? "bg-[linear-gradient(135deg,_#67e8c6,_#7cc8ff)] text-[#081925] shadow-[0_12px_30px_rgba(103,232,198,0.22)]"
                          : "text-white/62 hover:bg-white/6 hover:text-white"
                      }`}
                    >
                      Cadastrar
                    </button>
                  </div>

                  {activeTab === "login" ? (
                    <form
                      className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
                      onSubmit={handleLoginSubmit}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-white/78 text-xl">
                          E-mail
                        </Label>
                        <Input
                          id="login-email"
                          type="email"
                          autoComplete="email"
                          placeholder="Digite seu e-mail"
                          value={loginForm.email}
                          onChange={(event) =>
                            setLoginForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          className={authInputClassName}
                          aria-invalid={Boolean(currentErrors?.email?.length)}
                        />
                        <FieldMessage errors={currentErrors} field="email" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-white/78 text-xl">
                          Senha
                        </Label>
                        <PasswordField
                          id="login-password"
                          autoComplete="current-password"
                          placeholder="Sua senha"
                          value={loginForm.password}
                          onChange={(event) =>
                            setLoginForm((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                          className={authInputClassName}
                          aria-invalid={Boolean(currentErrors?.password?.length)}
                          isVisible={passwordVisibility.login}
                          onToggleVisibility={() =>
                            togglePasswordVisibility("login")
                          }
                        />
                        <FieldMessage errors={currentErrors} field="password" />
                      </div>

                      {status?.scope === "login" ? (
                        <Alert className="rounded-[1.2rem] border border-rose-300/18 bg-rose-300/8 px-4 py-3 text-rose-100">
                          <AlertTitle>Algo precisa de atencao</AlertTitle>
                          <AlertDescription className="text-rose-100/78">
                            {status.message}
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <Button
                        type="submit"
                        size="lg"
                        className="h-12 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,_#ff8a5c,_#ffd166)] text-[#081925] hover:brightness-105"
                        disabled={isBusy}
                      >
                        {activeAction === "login" ? "Entrando..." : "Entrar agora"}
                      </Button>
                    </form>
                  ) : null}

                  {activeTab === "register" ? (
                    <form
                      className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
                      onSubmit={handleRegisterSubmit}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="register-name" className="text-white/78 text-xl">
                          Nome completo
                        </Label>
                        <Input
                          id="register-name"
                          placeholder="Como voce gostaria de aparecer"
                          autoComplete="name"
                          value={registerForm.name}
                          onChange={(event) =>
                            setRegisterForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          className={authInputClassName}
                          aria-invalid={Boolean(currentErrors?.name?.length)}
                        />
                        <FieldMessage errors={currentErrors} field="name" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-email" className="text-white/78 text-xl">
                          E-mail
                        </Label>
                        <Input
                          id="register-email"
                          type="email"
                          autoComplete="email"
                          placeholder="seuemail@exemplo.com"
                          value={registerForm.email}
                          onChange={(event) =>
                            setRegisterForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          className={authInputClassName}
                          aria-invalid={Boolean(currentErrors?.email?.length)}
                        />
                        <FieldMessage errors={currentErrors} field="email" />
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label
                            htmlFor="register-password"
                            className="text-white/78 text-xl"
                          >
                            Senha
                          </Label>
                          <PasswordField
                            id="register-password"
                            autoComplete="new-password"
                            placeholder="Minimo de 8 caracteres"
                            value={registerForm.password}
                            onChange={(event) =>
                              setRegisterForm((current) => ({
                                ...current,
                                password: event.target.value,
                              }))
                            }
                            className={authInputClassName}
                            aria-invalid={Boolean(currentErrors?.password?.length)}
                            isVisible={passwordVisibility.register}
                            onToggleVisibility={() =>
                              togglePasswordVisibility("register")
                            }
                          />
                          <FieldMessage errors={currentErrors} field="password" />
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="register-confirm-password"
                            className="text-white/78 text-xl"
                          >
                            Confirmar senha
                          </Label>
                          <PasswordField
                            id="register-confirm-password"
                            autoComplete="new-password"
                            placeholder="Repita a senha"
                            value={registerForm.confirmPassword}
                            onChange={(event) =>
                              setRegisterForm((current) => ({
                                ...current,
                                confirmPassword: event.target.value,
                              }))
                            }
                            className={authInputClassName}
                            aria-invalid={Boolean(
                              currentErrors?.confirmPassword?.length,
                            )}
                            isVisible={passwordVisibility.confirm}
                            onToggleVisibility={() =>
                              togglePasswordVisibility("confirm")
                            }
                            toggleLabel="confirmacao da senha"
                          />
                          <FieldMessage
                            errors={currentErrors}
                            field="confirmPassword"
                          />
                        </div>
                      </div>

                      {status?.scope === "register" ? (
                        <Alert className="rounded-[1.2rem] border border-rose-300/18 bg-rose-300/8 px-4 py-3 text-rose-100">
                          <AlertTitle>Algo precisa de atencao</AlertTitle>
                          <AlertDescription className="text-rose-100/78">
                            {status.message}
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <Button
                        type="submit"
                        size="lg"
                        className="h-12 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,_#67e8c6,_#7cc8ff)] text-[#081925] hover:brightness-105"
                        disabled={isBusy}
                      >
                        {activeAction === "register"
                          ? "Criando conta..."
                          : "Criar conta segura"}
                      </Button>
                    </form>
                  ) : null}
                </div>
              )}
            </CardContent>

            <CardFooter className="justify-between gap-4 border-white/10 px-6 py-5 text-[11px] uppercase tracking-[0.24em] text-white/46 sm:px-8">
              <span className="flex items-center gap-2">
                <ShootingStar className="size-4 text-[#ff8a5c]" />
                feito para chegar com calma
              </span>
              <span className="flex items-center gap-2">
                <UserCirclePlus className="size-4 text-[#67e8c6]" />
                um canto seguro para continuar
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
