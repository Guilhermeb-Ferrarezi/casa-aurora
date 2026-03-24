export type ChatThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ChatAttachmentItem = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

export type ChatMessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: ChatAttachmentItem[];
  createdAt: string;
};

export type ChatBootstrapResponse = {
  threads: ChatThreadSummary[];
  activeThreadId: string | null;
  messages: ChatMessageItem[];
};

export type ChatThreadResponse = {
  threadId: string;
  messages: ChatMessageItem[];
};

export type ChatStreamCompletionData = {
  activeThreadId: string;
  thread: ChatThreadSummary;
  userMessage: ChatMessageItem;
  assistantMessage: ChatMessageItem;
};

export type ChatMessageStreamEvent =
  | {
      type: "thread";
      activeThreadId: string;
      thread: ChatThreadSummary;
    }
  | {
      type: "chunk";
      content: string;
    }
  | {
      type: "done";
      data: ChatStreamCompletionData;
    }
  | {
      type: "error";
      message: string;
    };
