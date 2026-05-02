import type { AiChatHistoryItem } from "./AiChatHistoryList";

export const aiAvatarChats: Record<string, AiChatHistoryItem[]> = {
  "ai-vision": [
    { id: "vision-1", title: "Image analysis tips" },
    { id: "vision-2", title: "Design critique" },
  ],
  "ai-spark": [
    { id: "spark-1", title: "Story outline" },
    { id: "spark-2", title: "Ad copy ideas" },
  ],
  "ai-logic": [
    { id: "logic-1", title: "Reasoning practice" },
    { id: "logic-2", title: "Decision tree" },
  ],
  "ai-echo": [
    { id: "echo-1", title: "Meeting summary" },
  ],
  "ai-code": [
    { id: "code-1", title: "Bug hunt" },
    { id: "code-2", title: "API design" },
  ],
  "ai-sage": [
    { id: "sage-1", title: "Research notes" },
  ],
};
