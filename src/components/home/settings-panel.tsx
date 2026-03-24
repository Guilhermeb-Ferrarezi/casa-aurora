"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle,
  CloudArrowUp,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AuthErrorResponse,
  AuthUser,
  AvatarUploadResponse,
  PasswordUpdateResponse,
} from "@/lib/auth/types";
import { UserAvatar } from "./user-avatar";

const ACCEPTED_AVATAR_TYPES = "image/png,image/jpeg,image/webp";
const SETTINGS_INPUT_CLASS_NAME =
  "h-12 rounded-[1.2rem] border-white/10 bg-[#081c27]/46 px-4 text-base md:text-base text-white placeholder:text-white/28 focus-visible:border-[#67e8c6]/55 focus-visible:ring-[#67e8c6]/35";

function buildAvatarSrc(avatarUrl: string, avatarVersion: number) {
  return `${avatarUrl}?v=${avatarVersion}`;
}

type SettingsPanelProps = {
  avatarVersion: number;
  onClose: () => void;
  onPhotoSaved: (nextUser: AuthUser, uploadedAt: number) => void;
  user: AuthUser;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialPasswordFormState: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function FieldMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-xs text-rose-300">{message}</p>;
}

export function SettingsPanel({
  avatarVersion,
  onClose,
  onPhotoSaved,
  user,
}: SettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [passwordForm, setPasswordForm] = useState(initialPasswordFormState);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<
    AuthErrorResponse["fieldErrors"]
  >(undefined);
  const [passwordStatusMessage, setPasswordStatusMessage] = useState<string | null>(
    null,
  );
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(
    null,
  );
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;

    setSelectedFile(nextFile);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  function handlePasswordChange(
    field: keyof PasswordFormState,
    value: string,
  ) {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
    setPasswordFieldErrors((current) =>
      current ? { ...current, [field]: undefined } : current,
    );
    setPasswordStatusMessage(null);
    setPasswordErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || isUploading) {
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("avatar", selectedFile);

      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as
        | AvatarUploadResponse
        | AuthErrorResponse
        | null;

      if (!response.ok || !data || !("user" in data)) {
        throw new Error(data?.message || "Nao foi possivel salvar sua foto agora.");
      }

      const uploadedAt = Date.parse(data.uploadedAt);

      onPhotoSaved(data.user, Number.isNaN(uploadedAt) ? Date.now() : uploadedAt);
      setSelectedFile(null);
      setStatusMessage(data.message);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar sua foto agora.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUpdatingPassword) {
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordFieldErrors(undefined);
    setPasswordStatusMessage(null);
    setPasswordErrorMessage(null);

    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      });
      const data = (await response.json().catch(() => null)) as
        | PasswordUpdateResponse
        | AuthErrorResponse
        | null;

      if (!response.ok || !data) {
        setPasswordFieldErrors(
          data && "fieldErrors" in data ? data.fieldErrors : undefined,
        );
        throw new Error(
          data?.message || "Nao foi possivel atualizar sua senha agora.",
        );
      }

      setPasswordForm(initialPasswordFormState);
      setPasswordStatusMessage(data.message);
    } catch (error) {
      setPasswordErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar sua senha agora.",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  const avatarSrc = previewUrl || buildAvatarSrc(user.avatarUrl, avatarVersion);

  return (
    <div className="fixed inset-0 z-50 px-4 py-6 sm:px-6 xl:px-10">
      <button
        type="button"
        aria-label="Fechar configuracoes"
        className="absolute inset-0 bg-[#07131d]/78 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative mx-auto flex h-full w-full max-w-5xl items-center justify-center">
        <div className="scrollbar-hidden max-h-full w-full overflow-y-auto rounded-[2.2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(7,25,37,0.96),rgba(10,28,39,0.98))] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.42)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <Badge className="w-fit border-[#7cc8ff]/18 bg-[#7cc8ff]/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[#d9f0ff]">
                configuracoes
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl leading-tight font-semibold text-white sm:text-4xl">
                  Deixe seu espaco com a sua cara.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-white/66 sm:text-base">
                  Sua foto fica guardada no bucket da Cloudflare e aparece aqui no
                  seu perfil sempre que voce voltar.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/6 px-4 py-3 text-[11px] uppercase tracking-[0.26em] text-white/48">
                perfil protegido
              </div>

              <button
                type="button"
                aria-label="Fechar configuracoes"
                className="flex size-11 items-center justify-center rounded-[1rem] border border-white/10 bg-white/6 text-white/74 transition hover:bg-white/10 hover:text-white"
                onClick={onClose}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <form
              onSubmit={handleSubmit}
              className="rounded-[1.8rem] border border-white/10 bg-[#0b2230]/58 p-5"
            >
              <div className="flex flex-col items-center text-center">
                <button
                  type="button"
                  className="group relative rounded-[2rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#67e8c6]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b2230] disabled:cursor-not-allowed disabled:opacity-70"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <div className="relative">
                    <UserAvatar
                      name={user.name}
                      avatarUrl={avatarSrc}
                      className="size-36 rounded-[2rem] border-white/16 transition duration-200 group-hover:scale-[1.02]"
                      fallbackClassName="text-2xl"
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-[2rem] border border-transparent bg-transparent transition group-hover:border-[#67e8c6]/36 group-hover:bg-[#081925]/16" />
                    <div className="absolute -bottom-3 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-[1rem] border border-white/12 bg-[linear-gradient(135deg,_#ff8a5c,_#ffd166)] text-[#081925] shadow-[0_16px_40px_rgba(255,138,92,0.24)] transition group-hover:scale-105">
                      <Camera className="size-5" weight="fill" />
                    </div>
                  </div>
                </button>

                <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-[#67e8c6]/78">
                  clique na foto para trocar
                </p>
                <p className="mt-5 text-lg font-medium text-white">{user.name}</p>
                <p className="mt-1 text-sm text-white/56">{user.email}</p>
                <p className="mt-4 text-xs leading-6 text-white/46">
                  JPG, PNG ou WebP. Ate 5 MB.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_AVATAR_TYPES}
                className="hidden"
                onChange={handleSelectFile}
              />

              <div className="mt-6">
                <Button
                  type="submit"
                  className="h-12 w-full rounded-[1.15rem] bg-[linear-gradient(135deg,_#67e8c6,_#7cc8ff)] text-[#081925] hover:brightness-105"
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? (
                    <SpinnerGap className="size-4 animate-spin" />
                  ) : (
                    <CloudArrowUp className="size-4" weight="fill" />
                  )}
                  {isUploading ? "Enviando foto..." : "Salvar foto"}
                </Button>
              </div>

              <div className="mt-4 min-h-6 text-center text-xs text-white/50">
                {selectedFile
                  ? `Arquivo selecionado: ${selectedFile.name}`
                  : "Clique na foto para escolher uma nova imagem."}
              </div>

              {statusMessage ? (
                <Alert className="mt-4 rounded-[1.2rem] border border-emerald-300/18 bg-emerald-300/8 px-4 py-3 text-emerald-100">
                  <AlertTitle className="flex items-center gap-2">
                    <CheckCircle className="size-4" weight="fill" />
                    Foto atualizada
                  </AlertTitle>
                  <AlertDescription className="text-emerald-100/78">
                    {statusMessage}
                  </AlertDescription>
                </Alert>
              ) : null}

              {errorMessage ? (
                <Alert className="mt-4 rounded-[1.2rem] border border-rose-300/18 bg-rose-300/8 px-4 py-3 text-rose-100">
                  <AlertTitle>Algo precisa de atencao</AlertTitle>
                  <AlertDescription className="text-rose-100/78">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              ) : null}
            </form>

            <div className="space-y-5">
              <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#67e8c6]">
                  dados da conta
                </p>
                <div className="mt-5 grid gap-4">
                  <div className="rounded-[1.3rem] border border-white/8 bg-[#081c27]/46 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                      nome
                    </p>
                    <p className="mt-2 text-base text-white">{user.name}</p>
                  </div>

                  <div className="rounded-[1.3rem] border border-white/8 bg-[#081c27]/46 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                      e-mail
                    </p>
                    <p className="mt-2 text-base text-white">{user.email}</p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handlePasswordSubmit}
                className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,138,92,0.12),rgba(124,200,255,0.08))] p-5"
              >
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#ffd166]">
                  alterar senha
                </p>
                <p className="mt-4 text-sm leading-7 text-white/68">
                  Atualize sua senha por aqui sempre que quiser reforcar a seguranca
                  da conta.
                </p>

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="settings-current-password"
                      className="text-sm text-white/74"
                    >
                      Senha atual
                    </Label>
                    <Input
                      id="settings-current-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Digite sua senha atual"
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        handlePasswordChange("currentPassword", event.target.value)
                      }
                      className={SETTINGS_INPUT_CLASS_NAME}
                      aria-invalid={Boolean(
                        passwordFieldErrors?.currentPassword?.length,
                      )}
                    />
                    <FieldMessage
                      message={passwordFieldErrors?.currentPassword?.[0]}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="settings-new-password"
                      className="text-sm text-white/74"
                    >
                      Nova senha
                    </Label>
                    <Input
                      id="settings-new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Minimo de 8 caracteres"
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        handlePasswordChange("newPassword", event.target.value)
                      }
                      className={SETTINGS_INPUT_CLASS_NAME}
                      aria-invalid={Boolean(passwordFieldErrors?.newPassword?.length)}
                    />
                    <FieldMessage message={passwordFieldErrors?.newPassword?.[0]} />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="settings-confirm-password"
                      className="text-sm text-white/74"
                    >
                      Confirmar nova senha
                    </Label>
                    <Input
                      id="settings-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repita a nova senha"
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        handlePasswordChange("confirmPassword", event.target.value)
                      }
                      className={SETTINGS_INPUT_CLASS_NAME}
                      aria-invalid={Boolean(
                        passwordFieldErrors?.confirmPassword?.length,
                      )}
                    />
                    <FieldMessage
                      message={passwordFieldErrors?.confirmPassword?.[0]}
                    />
                  </div>
                </div>

                {passwordStatusMessage ? (
                  <Alert className="mt-4 rounded-[1.2rem] border border-emerald-300/18 bg-emerald-300/8 px-4 py-3 text-emerald-100">
                    <AlertTitle className="flex items-center gap-2">
                      <CheckCircle className="size-4" weight="fill" />
                      Senha atualizada
                    </AlertTitle>
                    <AlertDescription className="text-emerald-100/78">
                      {passwordStatusMessage}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {passwordErrorMessage ? (
                  <Alert className="mt-4 rounded-[1.2rem] border border-rose-300/18 bg-rose-300/8 px-4 py-3 text-rose-100">
                    <AlertTitle>Algo precisa de atencao</AlertTitle>
                    <AlertDescription className="text-rose-100/78">
                      {passwordErrorMessage}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="mt-5">
                  <Button
                    type="submit"
                    className="h-12 w-full rounded-[1.15rem] bg-[linear-gradient(135deg,_#ff8a5c,_#ffd166)] text-[#081925] hover:brightness-105"
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? (
                      <SpinnerGap className="size-4 animate-spin" />
                    ) : null}
                    {isUpdatingPassword ? "Atualizando senha..." : "Salvar nova senha"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
