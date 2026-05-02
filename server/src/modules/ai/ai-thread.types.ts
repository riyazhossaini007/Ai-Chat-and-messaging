export type AiThreadCommandType = "GENERAL" | "SUMMARIZE" | "EXPLAIN" | "TRANSLATE";

export type AiJobInput = {
  threadId: string;
  userTurnId: string;
  aiTurnId: string;
  chatId: string;
  targetMessageId?: string | null;
  commandType: AiThreadCommandType;
  translateTo?: string;
  prompt: string;
  contextWindow: {
    before: number;
    after: number;
  };
};

