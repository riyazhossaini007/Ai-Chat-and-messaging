"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCallSocketEvents = void 0;
const errorHandler_1 = require("../../middlewares/errorHandler");
const call_service_1 = require("./call.service");
const mapErrorCode = (error) => {
    if (error instanceof errorHandler_1.AppError) {
        const details = error.details;
        if (typeof details?.code === "string")
            return details.code;
        if (error.statusCode === 402)
            return "paid-required";
        if (error.statusCode === 403)
            return "forbidden";
        if (error.statusCode === 404)
            return "not-found";
        if (error.statusCode === 429)
            return "rate-limited";
        if (error.statusCode === 409)
            return "state-conflict";
        return "invalid-payload";
    }
    return "server-error";
};
const emitCallError = (socket, error, callId) => {
    const code = mapErrorCode(error);
    const message = error instanceof Error ? error.message : "Call operation failed";
    socket.emit("call:error", { code, message, ...(callId ? { callId } : {}) });
};
const withSocketGuard = (socket, handler, callId) => {
    void handler().catch((error) => {
        emitCallError(socket, error, callId);
    });
};
const registerCallSocketEvents = (_io, socket) => {
    const currentUserId = socket.data.user.id;
    socket.on("call:start", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.startCall(currentUserId, payload);
        });
    });
    socket.on("call:cancel", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.cancelCall(currentUserId, payload);
        }, payload?.callId);
    });
    socket.on("call:accept", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.acceptCall(currentUserId, payload);
        }, payload?.callId);
    });
    socket.on("call:decline", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.declineCall(currentUserId, payload);
        }, payload?.callId);
    });
    socket.on("call:end", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.endCall(currentUserId, payload);
        }, payload?.callId);
    });
    socket.on("webrtc:offer", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.relayWebRtc(currentUserId, "webrtc:offer", payload);
        }, payload?.callId);
    });
    socket.on("webrtc:answer", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.relayWebRtc(currentUserId, "webrtc:answer", payload);
        }, payload?.callId);
    });
    socket.on("webrtc:ice", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.relayWebRtc(currentUserId, "webrtc:ice", payload);
        }, payload?.callId);
    });
    socket.on("webrtc:renegotiate", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.relayWebRtc(currentUserId, "webrtc:renegotiate", payload);
        }, payload?.callId);
    });
    socket.on("call:heartbeat", (payload) => {
        withSocketGuard(socket, async () => {
            await call_service_1.callService.heartbeat(currentUserId, payload);
        }, payload?.callId);
    });
};
exports.registerCallSocketEvents = registerCallSocketEvents;
