export function buildUserAvatarUrl(userId: string) {
  return `/api/account/avatar/${encodeURIComponent(userId)}`;
}
