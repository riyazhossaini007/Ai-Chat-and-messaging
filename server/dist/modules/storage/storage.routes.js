"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageRouter = void 0;
const express_1 = require("express");
const requireAuth_1 = require("../../middlewares/requireAuth");
const storage_controller_1 = require("./storage.controller");
const storageRouter = (0, express_1.Router)();
exports.storageRouter = storageRouter;
storageRouter.get("/usage", requireAuth_1.requireAuth, storage_controller_1.getStorageUsage);
