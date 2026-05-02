"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livekitWebhookRouter = void 0;
const express_1 = require("express");
const call_controller_1 = require("./call.controller");
const livekitWebhookRouter = (0, express_1.Router)();
exports.livekitWebhookRouter = livekitWebhookRouter;
livekitWebhookRouter.post("/livekit", call_controller_1.livekitWebhook);
