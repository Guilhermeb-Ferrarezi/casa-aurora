import "server-only";

import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { validateChatAttachmentFile } from "@/lib/chat/attachments";

const AVATAR_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedAvatarMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type GlobalR2State = typeof globalThis & {
  r2Client?: S3Client;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} nao configurado.`);
  }

  return value;
}

function getR2BucketName() {
  return getRequiredEnv("CLOUDFLARE_BUCKET_NAME");
}

function getR2Credentials() {
  return {
    accessKeyId: getRequiredEnv("CLOUDFLARE_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("CLOUDFLARE_SECRET_ACCESS_KEY"),
  };
}

function getR2Client() {
  const globalForR2 = globalThis as GlobalR2State;

  if (!globalForR2.r2Client) {
    globalForR2.r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${getRequiredEnv("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: getR2Credentials(),
    });
  }

  return globalForR2.r2Client;
}

function getUserAvatarObjectKey(userId: string) {
  return `avatars/${userId}`;
}

function normalizeFileStem(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/\.[^.]+$/, "");

  const safeStem = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return safeStem || "imagem";
}

function getFileExtension(file: File) {
  const extensionFromName = file.name.split(".").pop()?.toLowerCase();

  if (extensionFromName && /^[a-z0-9]{2,5}$/.test(extensionFromName)) {
    return extensionFromName;
  }

  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function getChatAttachmentObjectKey({
  userId,
  threadId,
  file,
}: {
  userId: string;
  threadId: string;
  file: File;
}) {
  const extension = getFileExtension(file);
  const fileStem = normalizeFileStem(file.name || "imagem");

  return `chat-attachments/${userId}/${threadId}/${randomUUID()}-${fileStem}.${extension}`;
}

export function validateAvatarFile(file: File) {
  if (!allowedAvatarMimeTypes.has(file.type)) {
    return "Escolha uma imagem JPG, PNG ou WebP.";
  }

  if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
    return "A foto precisa ter no maximo 5 MB.";
  }

  return null;
}

export async function uploadUserAvatar({
  userId,
  file,
}: {
  userId: string;
  file: File;
}) {
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: getUserAvatarObjectKey(userId),
      Body: fileBuffer,
      ContentLength: fileBuffer.byteLength,
      ContentType: file.type,
      ContentDisposition: "inline",
      CacheControl: "private, no-store, max-age=0",
    }),
  );
}

type R2ObjectResponse = {
  body: {
    transformToByteArray?: () => Promise<Uint8Array>;
    transformToWebStream: () => ReadableStream<Uint8Array>;
  };
  contentLength?: number | null;
  contentType: string;
  etag?: string;
};

async function getObjectByKey(storageKey: string): Promise<R2ObjectResponse | null> {
  try {
    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: storageKey,
      }),
    );

    if (!response.Body) {
      return null;
    }

    return {
      body: response.Body,
      contentLength: response.ContentLength,
      contentType: response.ContentType || "application/octet-stream",
      etag: response.ETag,
    };
  } catch (error) {
    if (error instanceof S3ServiceException && error.name === "NoSuchKey") {
      return null;
    }

    throw error;
  }
}

export async function uploadChatAttachment({
  userId,
  threadId,
  file,
}: {
  userId: string;
  threadId: string;
  file: File;
}) {
  const validationMessage = validateChatAttachmentFile(file);

  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const storageKey = getChatAttachmentObjectKey({
    userId,
    threadId,
    file,
  });
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: storageKey,
      Body: fileBuffer,
      ContentLength: fileBuffer.byteLength,
      ContentType: file.type,
      ContentDisposition: "inline",
      CacheControl: "private, no-store, max-age=0",
    }),
  );

  return {
    storageKey,
    mimeType: file.type,
    originalName: file.name || "imagem",
    sizeBytes: file.size,
  };
}

export async function deleteChatAttachmentObjects(storageKeys: string[]) {
  await Promise.allSettled(
    storageKeys.map((storageKey) =>
      getR2Client().send(
        new DeleteObjectCommand({
          Bucket: getR2BucketName(),
          Key: storageKey,
        }),
      ),
    ),
  );
}

export async function getUserAvatarObject(userId: string) {
  return getObjectByKey(getUserAvatarObjectKey(userId));
}

export async function getChatAttachmentObject(storageKey: string) {
  return getObjectByKey(storageKey);
}

export async function getChatAttachmentDataUrl(
  storageKey: string,
  mimeType: string,
) {
  const object = await getChatAttachmentObject(storageKey);

  if (!object?.body.transformToByteArray) {
    throw new Error("Nao foi possivel converter o anexo em bytes.");
  }

  const bytes = await object.body.transformToByteArray();

  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}
