CREATE TABLE "ChatMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatMessageAttachment_storageKey_key" ON "ChatMessageAttachment"("storageKey");
CREATE INDEX "ChatMessageAttachment_messageId_createdAt_idx" ON "ChatMessageAttachment"("messageId", "createdAt");

ALTER TABLE "ChatMessageAttachment"
ADD CONSTRAINT "ChatMessageAttachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
