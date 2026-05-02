import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import {
  archiveChat,
  createDirect,
  deleteChat,
  getChats,
  getUnreadSummary,
  getUnreadTotal,
  markChatRead,
  reorderChats,
  shareChat,
  togglePinChat,
  unarchiveChat,
} from "./chat.controller";
import { createOrGetPrivateChat } from "./chat.private.controller";

const chatRouter = Router();

chatRouter.post("/direct", requireAuth, createDirect);
chatRouter.post("/private", requireAuth, createOrGetPrivateChat);
chatRouter.get("/", requireAuth, getChats);
chatRouter.get("/unread/summary", requireAuth, getUnreadSummary);
chatRouter.get("/unread/total", requireAuth, getUnreadTotal);
chatRouter.patch("/reorder", requireAuth, reorderChats);
chatRouter.patch("/:chatId/read", requireAuth, markChatRead);
chatRouter.patch("/:chatId/pin", requireAuth, togglePinChat);
chatRouter.patch("/:chatId/archive", requireAuth, archiveChat);
chatRouter.patch("/:chatId/unarchive", requireAuth, unarchiveChat);
chatRouter.delete("/:id", requireAuth, deleteChat);
chatRouter.get("/share/chat/:id", requireAuth, shareChat);

export { chatRouter };
