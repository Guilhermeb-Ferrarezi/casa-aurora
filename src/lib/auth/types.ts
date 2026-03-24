import type { Prisma } from "@prisma/client";
import { buildUserAvatarUrl } from "@/lib/auth/avatar";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

type PublicUserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export type AuthUser = PublicUserRecord & {
  avatarUrl: string;
};

export function toAuthUser(user: PublicUserRecord): AuthUser {
  return {
    ...user,
    avatarUrl: buildUserAvatarUrl(user.id),
  };
}

export type AuthResponse = {
  user: AuthUser;
  message?: string;
};

export type AvatarUploadResponse = {
  user: AuthUser;
  message: string;
  uploadedAt: string;
};

export type PasswordUpdateResponse = {
  message: string;
};

export type AuthErrorResponse = {
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
