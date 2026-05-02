"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.livekitService = void 0;
const env_1 = require("../../../config/env");
const errorHandler_1 = require("../../../middlewares/errorHandler");
const LIVEKIT_SERVER_SDK_MODULE = "livekit-server-sdk";
const requireLivekitConfig = () => {
    if (!env_1.env.LIVEKIT_URL || !env_1.env.LIVEKIT_API_KEY || !env_1.env.LIVEKIT_API_SECRET) {
        throw new errorHandler_1.AppError(500, "LiveKit is not configured");
    }
};
const normalizeRoomName = (callId) => `call_${callId}`;
const loadSdk = async () => {
    const moduleName = LIVEKIT_SERVER_SDK_MODULE;
    const sdk = (await Promise.resolve(`${moduleName}`).then(s => __importStar(require(s))));
    return sdk;
};
const ensureRoom = async (roomName) => {
    requireLivekitConfig();
    const sdk = await loadSdk();
    const roomService = new sdk.RoomServiceClient(env_1.env.LIVEKIT_URL, env_1.env.LIVEKIT_API_KEY, env_1.env.LIVEKIT_API_SECRET);
    await roomService.createRoom({
        name: roomName,
        emptyTimeout: 10 * 60,
        maxParticipants: 100,
    });
    return { roomName };
};
const deleteRoom = async (roomName) => {
    requireLivekitConfig();
    const sdk = await loadSdk();
    const roomService = new sdk.RoomServiceClient(env_1.env.LIVEKIT_URL, env_1.env.LIVEKIT_API_KEY, env_1.env.LIVEKIT_API_SECRET);
    try {
        await roomService.deleteRoom(roomName);
    }
    catch {
        return;
    }
};
const mintJoinToken = async (input) => {
    requireLivekitConfig();
    const sdk = await loadSdk();
    const token = new sdk.AccessToken(env_1.env.LIVEKIT_API_KEY, env_1.env.LIVEKIT_API_SECRET, {
        identity: input.userId,
        name: input.name ?? input.userId,
        ttl: "1h",
    });
    token.addGrant({
        roomJoin: true,
        room: input.roomName,
        canPublish: input.canPublish ?? true,
        canSubscribe: input.canSubscribe ?? true,
        canPublishData: true,
    });
    return {
        livekitUrl: env_1.env.LIVEKIT_URL,
        token: await token.toJwt(),
        roomName: input.roomName,
    };
};
const verifyWebhookEvent = async (rawBody, authHeader) => {
    requireLivekitConfig();
    const sdk = await loadSdk();
    const receiver = new sdk.WebhookReceiver(env_1.env.LIVEKIT_API_KEY, env_1.env.LIVEKIT_API_SECRET);
    const payload = await receiver.receive(rawBody.toString("utf-8"), authHeader ?? "");
    return payload;
};
exports.livekitService = {
    normalizeRoomName,
    ensureRoom,
    deleteRoom,
    mintJoinToken,
    verifyWebhookEvent,
};
