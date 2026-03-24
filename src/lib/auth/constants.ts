export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME?.trim() || "auth_token";

export const AUTH_TOKEN_TTL = "7d";
export const AUTH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;
