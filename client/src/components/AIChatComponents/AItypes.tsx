
export type Role = "user" | "ai" | "system";
export type MessageType = "text" | "image";
export type AiModel = "openrouter" | "openai" | "claude" | "gemini" | "grok";

export interface AiMessage {
  id: string;
  role: Role;
  type: MessageType;
  content: string; // text OR image URL
  createdAt: string;
  modelUsed?: AiModel;
  sourceUserMessageId?: string;
  kind?: "normal" | "paywall" | "degraded";
  reaction?: "LIKE" | "DISLIKE" | null;
  canRegenerate?: boolean;
  isDeleted?: boolean;
  isPinned?: boolean;
  suggestedModels?: AiModel[];
  switchedFromModel?: AiModel;
  switchedToModel?: AiModel;
}
