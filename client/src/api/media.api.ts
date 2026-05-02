import { api } from "./api";
import type { ApiEnvelope, MediaMessageRecord } from "./types";

export const fetchChatMedia = async (
  chatId: string,
  scope: "chat" | "all" = "chat"
) => {
  const response = await api.get<ApiEnvelope<{ media: MediaMessageRecord[] }>>(
    `/media/chat/${chatId}`,
    {
      params: {
        filter: scope === "all" ? "ALL_MEDIA" : "THIS_CHAT",
      },
    }
  );

  return response.data.data.media;
};
