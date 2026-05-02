import type { MessageRecord } from "../../api/types";
import type { GroupMessage } from "../../components/chatComponents/GroupMessageBubble";

export type GroupClientMessage = MessageRecord & {
  localId?: string;
  localStatus?: "SENDING";
  readCount: number;
  deliveredToAtLeastOne?: boolean;
};

const normalizeGroupMessage = (message: MessageRecord): GroupClientMessage => ({
  ...message,
  readCount: message.readCount ?? 0,
  deliveredToAtLeastOne: Boolean(message.deliveredToAtLeastOne),
  reactionSummary: message.reactionSummary ?? [],
});

const toContentType = (type: "TEXT" | "IMAGE" | "VIDEO" | "FILE"): GroupMessage["contentType"] => {
  if (type === "IMAGE") return "image";
  if (type === "VIDEO") return "video";
  if (type === "FILE") return "file";
  return "text";
};

const toGroupMessageType = (file: File): "IMAGE" | "VIDEO" | "FILE" => {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  return "FILE";
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export { fileToDataUrl, normalizeGroupMessage, toContentType, toGroupMessageType };
