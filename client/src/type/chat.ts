export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type AiChatSession = {
  chatId: string;
  username: string;
  messages: AiMessage[];
  updatedAt: number;
};
export type Message = {
  id: string;
  role: "me" | "them";
  content: string;
  createdAt: number;
};

export type ChatSession = {
  chatId: string;
  username: string;
  messages: Message[];
  updatedAt: number;
};
