"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareRouter = void 0;
const express_1 = require("express");
const requireAuth_1 = require("../../middlewares/requireAuth");
const chat_controller_1 = require("./chat.controller");
const shareRouter = (0, express_1.Router)();
exports.shareRouter = shareRouter;
shareRouter.get("/chat/:id", requireAuth_1.requireAuth, chat_controller_1.shareChat);
