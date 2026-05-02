"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const socket_auth_1 = require("./socket.auth");
const socket_events_1 = require("./socket.events");
let io = null;
const resolveCorsOrigin = () => (env_1.env.CORS_ORIGIN === "*" ? true : env_1.env.CORS_ORIGIN);
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: resolveCorsOrigin(),
            credentials: true,
        },
    });
    io.use(socket_auth_1.socketAuthMiddleware);
    (0, socket_events_1.registerSocketEvents)(io);
    return io;
};
exports.initSocket = initSocket;
const getIO = () => io;
exports.getIO = getIO;
