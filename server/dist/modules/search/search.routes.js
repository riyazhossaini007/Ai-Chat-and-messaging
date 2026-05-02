"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = void 0;
const express_1 = require("express");
const requireAuth_1 = require("../../middlewares/requireAuth");
const search_controller_1 = require("./search.controller");
const searchRouter = (0, express_1.Router)();
exports.searchRouter = searchRouter;
searchRouter.get("/semantic", requireAuth_1.requireAuth, search_controller_1.getSemanticSearch);
