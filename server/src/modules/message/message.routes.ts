import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import {
  createMessage,
  deleteMessages,
  getMessageReads,
  getMessageReactions,
  deleteMessage,
  forwardMessages,
  getMessages,
  markChatRead,
  toggleMessageReaction,
} from "./message.controller";

const messageRouter = Router();

messageRouter.post("/", requireAuth, createMessage);
messageRouter.post("/forward", requireAuth, forwardMessages);
messageRouter.post("/delete", requireAuth, deleteMessages);
messageRouter.post("/:messageId/react", requireAuth, toggleMessageReaction);
messageRouter.get("/:chatId", requireAuth, getMessages);
messageRouter.patch("/read/:chatId", requireAuth, markChatRead);
messageRouter.get("/:messageId/reads", requireAuth, getMessageReads);
messageRouter.get("/:messageId/reactions", requireAuth, getMessageReactions);
messageRouter.delete("/:id", requireAuth, deleteMessage);

export { messageRouter };
