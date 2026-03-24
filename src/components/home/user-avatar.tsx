"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

function getUserInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "CA";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

type UserAvatarProps = {
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
  name: string;
};

export function UserAvatar({
  avatarUrl,
  className,
  fallbackClassName,
  imageClassName,
  name,
}: UserAvatarProps) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const initials = useMemo(() => getUserInitials(name), [name]);
  const hasImageError = !avatarUrl || failedAvatarUrl === avatarUrl;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.4rem] border border-white/12 bg-[linear-gradient(135deg,_rgba(255,138,92,0.92),_rgba(124,200,255,0.72))]",
        className,
      )}
    >
      {avatarUrl && !hasImageError ? (
        <Image
          key={avatarUrl}
          src={avatarUrl}
          alt={`Foto de ${name}`}
          fill
          unoptimized
          sizes="144px"
          className={cn("object-cover", imageClassName)}
          onError={() => setFailedAvatarUrl(avatarUrl)}
        />
      ) : (
        <span
          className={cn(
            "flex size-full items-center justify-center text-sm font-semibold tracking-[0.18em] text-white",
            fallbackClassName,
          )}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
