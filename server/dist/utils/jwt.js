"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.issueJwt = void 0;
const jwt_1 = require("../config/jwt");
const issueJwt = (userId) => (0, jwt_1.signToken)(userId);
exports.issueJwt = issueJwt;
const verifyToken = (token) => (0, jwt_1.verifyToken)(token);
exports.verifyToken = verifyToken;
