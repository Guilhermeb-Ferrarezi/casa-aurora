import { buildUserAvatarUrl } from "@/lib/auth/avatar";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
} as const;

type PublicUserRecord = {
  id: string;
  name: string;
  email: string;
};

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
