import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const CHAT_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
let cachedChatEncryptionKey: Buffer | null = null;

function getChatEncryptionKey() {
  if (cachedChatEncryptionKey) {
    return cachedChatEncryptionKey;
  }

  const secret = process.env.CHAT_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new Error("CHAT_ENCRYPTION_KEY nao configurado.");
  }

  cachedChatEncryptionKey = createHash("sha256").update(secret).digest();

  return cachedChatEncryptionKey;
}

export function encryptChatText(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(CHAT_ALGORITHM, getChatEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptChatText(payload: string) {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Payload criptografado invalido.");
  }

  const decipher = createDecipheriv(
    CHAT_ALGORITHM,
    getChatEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
