"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRouter = void 0;
const express_1 = require("express");
const requireAuth_1 = require("../../middlewares/requireAuth");
const media_controller_1 = require("./media.controller");
const mediaRouter = (0, express_1.Router)();
exports.mediaRouter = mediaRouter;
mediaRouter.get("/chat/:chatId", requireAuth_1.requireAuth, media_controller_1.getChatMedia);
