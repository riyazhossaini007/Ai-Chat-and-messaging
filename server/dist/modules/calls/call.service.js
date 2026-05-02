"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callService = void 0;
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const errorHandler_1 = require("../../middlewares/errorHandler");
const socket_1 = require("../../socket");
const chat_service_1 = require("../chat/chat.service");
const featureGate_service_1 = require("../admin/featureGate.service");
const livekit_service_1 = require("./sfu/livekit.service");
const call_types_1 = require("./call.types");
const CALL_RING_TIMEOUT_MS = 30000;
const DISCONNECT_GRACE_MS = 10000;
const CALL_START_RATE_LIMIT_WINDOW_MS = 60000;
const CALL_START_RATE_LIMIT_MAX = 5;
const SFU_JOIN_RATE_LIMIT_WINDOW_MS = 60000;
const SFU_JOIN_RATE_LIMIT_MAX = 12;
const runtimeCalls = new Map();
const userActiveCall = new Map();
const callStartRate = new Map();
const sfuJoinRate = new Map();
const prismaAny = prisma_1.prisma;
const isCallingEnabled = () => env_1.env.CALLING_ENABLED;
const mapDbStatusToCallState = (status) => {
    const normalized = status.toLowerCase();
    if (Object.values(call_types_1.CALL_STATE).includes(normalized))
        return normalized;
    return call_types_1.CALL_STATE.FAILED;
};
const nowIso = () => new Date().toISOString();
const emitCallError = (userId, payload) => {
    const io = (0, socket_1.getIO)();
    if (!io)
        return;
    io.to((0, socket_1.userRoom)(userId)).emit("call:error", payload);
};
const emitToUser = (userId, event, payload) => {
    const io = (0, socket_1.getIO)();
    if (!io)
        return;
    io.to((0, socket_1.userRoom)(userId)).emit(event, payload);
};
const emitToParticipants = (participantIds, event, payload) => {
    participantIds.forEach((participantId) => {
        emitToUser(participantId, event, payload);
    });
};
const toCallIncomingPayload = (input) => input;
const checkStartRateLimit = (userId) => {
    const now = Date.now();
    const current = callStartRate.get(userId);
    if (!current || now - current.windowStart > CALL_START_RATE_LIMIT_WINDOW_MS) {
        callStartRate.set(userId, { count: 1, windowStart: now });
        return;
    }
    current.count += 1;
    callStartRate.set(userId, current);
    if (current.count > CALL_START_RATE_LIMIT_MAX) {
        throw new errorHandler_1.AppError(429, "Too many call attempts. Please wait.");
    }
};
const checkSfuJoinRateLimit = (userId) => {
    const now = Date.now();
    const current = sfuJoinRate.get(userId);
    if (!current || now - current.windowStart > SFU_JOIN_RATE_LIMIT_WINDOW_MS) {
        sfuJoinRate.set(userId, { count: 1, windowStart: now });
        return;
    }
    current.count += 1;
    sfuJoinRate.set(userId, current);
    if (current.count > SFU_JOIN_RATE_LIMIT_MAX) {
        throw new errorHandler_1.AppError(429, "Too many SFU join attempts", { code: "rate-limited" });
    }
};
const isUserBusy = async (userId, excludingCallId) => {
    const runtime = userActiveCall.get(userId);
    if (runtime && runtime !== excludingCallId)
        return true;
    const active = await prismaAny.callParticipant?.findFirst?.({
        where: {
            userId,
            leftAt: null,
            callSession: {
                status: {
                    in: ["ringing", "accepted", "in_progress"],
                },
            },
            ...(excludingCallId
                ? {
                    callId: { not: excludingCallId },
                }
                : {}),
        },
        select: { id: true },
    });
    return Boolean(active);
};
const assertCallingEnabled = () => {
    if (!isCallingEnabled()) {
        throw new errorHandler_1.AppError(403, "Calling is disabled");
    }
};
const sanitizeParticipantIds = (ids) => Array.from(new Set(ids.filter(Boolean)));
const resolveParticipants = async (callerId, input) => {
    const isGroup = Boolean(input.isGroup);
    if (isGroup) {
        if (!input.chatId)
            throw new errorHandler_1.AppError(400, "chatId is required for group calls");
        await chat_service_1.chatService.assertParticipant(callerId, input.chatId);
        const chat = await prisma_1.prisma.chat.findUnique({
            where: { id: input.chatId },
            select: {
                id: true,
                type: true,
                participants: { select: { userId: true } },
            },
        });
        if (!chat)
            throw new errorHandler_1.AppError(404, "Chat not found");
        if (chat.type !== "GROUP")
            throw new errorHandler_1.AppError(400, "Group calls require a group chat");
        const participantIds = sanitizeParticipantIds(chat.participants.map((item) => item.userId));
        return { participantIds, chatId: chat.id, isGroup: true };
    }
    if (!input.peerUserId && !input.chatId) {
        throw new errorHandler_1.AppError(400, "peerUserId or chatId is required");
    }
    if (input.chatId) {
        await chat_service_1.chatService.assertParticipant(callerId, input.chatId);
        const chat = await prisma_1.prisma.chat.findUnique({
            where: { id: input.chatId },
            select: {
                id: true,
                type: true,
                participants: { select: { userId: true } },
            },
        });
        if (!chat)
            throw new errorHandler_1.AppError(404, "Chat not found");
        if (chat.type !== "DIRECT")
            throw new errorHandler_1.AppError(400, "Direct calls require a direct chat");
        const participantIds = sanitizeParticipantIds(chat.participants.map((item) => item.userId));
        if (participantIds.length !== 2)
            throw new errorHandler_1.AppError(403, "Invalid direct chat participants");
        return { participantIds, chatId: chat.id, isGroup: false };
    }
    const peerUserId = input.peerUserId;
    if (peerUserId === callerId)
        throw new errorHandler_1.AppError(400, "Cannot call yourself");
    const directChat = await prisma_1.prisma.chat.findFirst({
        where: {
            type: "DIRECT",
            participants: { some: { userId: callerId } },
            AND: [{ participants: { some: { userId: peerUserId } } }],
        },
        select: {
            id: true,
            participants: { select: { userId: true } },
            _count: { select: { participants: true } },
        },
        orderBy: { lastMessageAt: "desc" },
    });
    if (!directChat || directChat._count.participants !== 2) {
        throw new errorHandler_1.AppError(403, "Direct call not allowed without a direct chat");
    }
    return {
        participantIds: sanitizeParticipantIds(directChat.participants.map((item) => item.userId)),
        chatId: directChat.id,
        isGroup: false,
    };
};
const upsertRuntimeCall = (call) => {
    runtimeCalls.set(call.callId, call);
    call.participants.forEach((userId) => {
        userActiveCall.set(userId, call.callId);
    });
};
const clearRuntimeCall = (callId) => {
    const runtime = runtimeCalls.get(callId);
    if (!runtime)
        return;
    if (runtime.ringTimeout) {
        clearTimeout(runtime.ringTimeout);
    }
    runtime.disconnectTimers.forEach((timer) => clearTimeout(timer));
    runtimeCalls.delete(callId);
    runtime.participants.forEach((userId) => {
        if (userActiveCall.get(userId) === callId) {
            userActiveCall.delete(userId);
        }
    });
};
const logCallEvent = async (callId, userId, eventType, payload) => {
    await prismaAny.callEvent?.create?.({
        data: {
            callId,
            userId,
            eventType,
            payload,
        },
    });
};
const updateCallStatus = async (callId, status, patch) => {
    await prismaAny.callSession?.update?.({
        where: { id: callId },
        data: {
            status,
            ...(patch?.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
            ...(patch?.connectedAt !== undefined ? { connectedAt: patch.connectedAt } : {}),
            ...(patch?.endedAt !== undefined ? { endedAt: patch.endedAt } : {}),
            ...(patch?.durationSec !== undefined ? { durationSec: patch.durationSec } : {}),
            ...(patch?.failureReason !== undefined ? { failureReason: patch.failureReason } : {}),
            ...(patch?.meta !== undefined ? { meta: patch.meta } : {}),
        },
    });
};
const setParticipantStatus = async (callId, userId, status, patch) => {
    await prismaAny.callParticipant?.updateMany?.({
        where: { callId, userId },
        data: {
            status,
            ...(patch?.joinedAt !== undefined ? { joinedAt: patch.joinedAt } : {}),
            ...(patch?.leftAt !== undefined ? { leftAt: patch.leftAt } : {}),
            ...(patch?.deviceInfo !== undefined ? { deviceInfo: patch.deviceInfo } : {}),
        },
    });
};
const validateCallAccess = async (callId, userId) => {
    const call = await prismaAny.callSession?.findUnique?.({
        where: { id: callId },
        include: {
            participants: {
                select: {
                    userId: true,
                    role: true,
                    status: true,
                    joinedAt: true,
                    leftAt: true,
                },
            },
        },
    });
    if (!call)
        throw new errorHandler_1.AppError(404, "Call not found");
    const isParticipant = call.participants.some((participant) => participant.userId === userId);
    if (!isParticipant)
        throw new errorHandler_1.AppError(403, "Forbidden");
    return call;
};
const endCallInternal = async (callId, endedByUserId, reason, endedAt = new Date()) => {
    const call = await prismaAny.callSession?.findUnique?.({
        where: { id: callId },
        include: { participants: true },
    });
    if (!call)
        return;
    const startedRef = call.connectedAt ?? call.startedAt ?? call.createdAt;
    const durationSec = startedRef
        ? Math.max(0, Math.floor((endedAt.getTime() - new Date(startedRef).getTime()) / 1000))
        : 0;
    await updateCallStatus(callId, reason === call_types_1.CALL_STATE.ENDED ? call_types_1.CALL_STATE.ENDED : reason, {
        endedAt,
        durationSec,
        failureReason: reason === call_types_1.CALL_STATE.FAILED || reason === call_types_1.CALL_STATE.TIMEOUT || reason === call_types_1.CALL_STATE.MISSED
            ? String(reason)
            : null,
    });
    await prismaAny.callParticipant?.updateMany?.({
        where: {
            callId,
            leftAt: null,
        },
        data: {
            leftAt: endedAt,
            status: reason === call_types_1.CALL_STATE.MISSED
                ? "missed"
                : reason === call_types_1.CALL_STATE.DECLINED
                    ? "declined"
                    : reason === call_types_1.CALL_STATE.BUSY
                        ? "busy"
                        : "ended",
        },
    });
    await logCallEvent(callId, endedByUserId, "CALL_ENDED", {
        reason,
        endedAt: endedAt.toISOString(),
    });
    const participantIds = call.participants.map((item) => item.userId);
    emitToParticipants(participantIds, "call:ended", {
        callId,
        state: reason,
        endedAt: endedAt.toISOString(),
    });
    clearRuntimeCall(callId);
};
const attachRingTimeout = (runtime) => {
    runtime.ringTimeout = setTimeout(async () => {
        const call = await prismaAny.callSession?.findUnique?.({
            where: { id: runtime.callId },
            include: { participants: true },
        });
        if (!call) {
            clearRuntimeCall(runtime.callId);
            return;
        }
        if (call.status !== call_types_1.CALL_STATE.RINGING)
            return;
        await prismaAny.callParticipant?.updateMany?.({
            where: {
                callId: runtime.callId,
                status: "ringing",
            },
            data: {
                status: "missed",
                leftAt: new Date(),
            },
        });
        await updateCallStatus(runtime.callId, call_types_1.CALL_STATE.TIMEOUT, {
            endedAt: new Date(),
            failureReason: "timeout",
        });
        await logCallEvent(runtime.callId, null, "CALL_TIMEOUT", {});
        const callerId = call.createdBy;
        emitToParticipants(runtime.participants.filter((id) => id !== callerId), "call:missed", {
            callId: runtime.callId,
            state: call_types_1.CALL_STATE.TIMEOUT,
        });
        emitToUser(callerId, "call:failed", {
            callId: runtime.callId,
            reason: call_types_1.CALL_STATE.TIMEOUT,
        });
        clearRuntimeCall(runtime.callId);
    }, CALL_RING_TIMEOUT_MS);
};
const assertCallingFeature = async (userId, featureKey) => {
    const allowed = await featureGate_service_1.featureGateService.canUseFeature(userId, featureKey);
    if (!allowed) {
        throw new errorHandler_1.AppError(402, "Feature access required for calling", {
            code: "feature-required",
            featureKey,
        });
    }
};
const startCall = async (callerUserId, input) => {
    assertCallingEnabled();
    checkStartRateLimit(callerUserId);
    if (await isUserBusy(callerUserId)) {
        emitToUser(callerUserId, "call:busy", { callId: "", userId: callerUserId });
        throw new errorHandler_1.AppError(409, "User is already in an active call", { code: "busy" });
    }
    const { participantIds, chatId, isGroup } = await resolveParticipants(callerUserId, input);
    await assertCallingFeature(callerUserId, isGroup ? "GROUP_CALLING" : "CALLING");
    if (participantIds.length < 2) {
        throw new errorHandler_1.AppError(400, "At least 2 participants are required");
    }
    const callees = participantIds.filter((id) => id !== callerUserId);
    for (const calleeUserId of callees) {
        if (await isUserBusy(calleeUserId)) {
            emitToUser(callerUserId, "call:busy", { callId: "", userId: calleeUserId });
            throw new errorHandler_1.AppError(409, "Participant is busy", { code: "busy", participantId: calleeUserId });
        }
    }
    const created = await prismaAny.callSession?.create?.({
        data: {
            type: input.type,
            isGroup,
            chatId,
            createdBy: callerUserId,
            hostUserId: callerUserId,
            sfuProvider: isGroup && input.type === "VIDEO" ? "LIVEKIT" : "NONE",
            roomName: null,
            status: call_types_1.CALL_STATE.RINGING,
            participants: {
                create: participantIds.map((participantId) => ({
                    userId: participantId,
                    role: participantId === callerUserId ? "CALLER" : "CALLEE",
                    status: "ringing",
                    ...(participantId === callerUserId
                        ? {
                            joinedAt: new Date(),
                            deviceInfo: input.deviceInfo ?? {},
                        }
                        : {}),
                })),
            },
        },
        include: {
            participants: {
                select: { userId: true },
            },
        },
    });
    const callId = String(created.id);
    if (isGroup && input.type === "VIDEO") {
        const roomName = livekit_service_1.livekitService.normalizeRoomName(callId);
        await prismaAny.callSession?.update?.({
            where: { id: callId },
            data: { roomName },
        });
        await livekit_service_1.livekitService.ensureRoom(roomName);
        await logCallEvent(callId, callerUserId, "sfu_room_created", {
            provider: "LIVEKIT",
            roomName,
        });
    }
    const expiresAt = new Date(Date.now() + CALL_RING_TIMEOUT_MS).toISOString();
    const runtime = {
        callId,
        participants: participantIds,
        type: input.type,
        isGroup,
        chatId: chatId ?? null,
        createdBy: callerUserId,
        status: call_types_1.CALL_STATE.RINGING,
        disconnectTimers: new Map(),
        heartbeat: new Map(),
    };
    upsertRuntimeCall(runtime);
    attachRingTimeout(runtime);
    await logCallEvent(callId, callerUserId, "CALL_STARTED", {
        type: input.type,
        isGroup,
        chatId,
        participants: participantIds,
    });
    emitToUser(callerUserId, "call:ringing", {
        callId,
        type: input.type,
        isGroup,
        chatId: chatId ?? null,
        state: call_types_1.CALL_STATE.RINGING,
        participants: callees,
        expiresAt,
    });
    const incoming = toCallIncomingPayload({
        callId,
        fromUserId: callerUserId,
        type: input.type,
        isGroup,
        chatId: chatId ?? null,
        participants: participantIds,
        state: call_types_1.CALL_STATE.RINGING,
        expiresAt,
    });
    callees.forEach((calleeUserId) => emitToUser(calleeUserId, "call:incoming", incoming));
    return {
        callId,
        state: call_types_1.CALL_STATE.RINGING,
        participants: participantIds,
        expiresAt,
    };
};
const acceptCall = async (userId, payload, deviceInfo) => {
    assertCallingEnabled();
    const call = await validateCallAccess(payload.callId, userId);
    await assertCallingFeature(userId, call.isGroup ? "GROUP_CALLING" : "CALLING");
    if (call.status !== call_types_1.CALL_STATE.RINGING && call.status !== call_types_1.CALL_STATE.ACCEPTED) {
        throw new errorHandler_1.AppError(409, "Call is not in ringing state");
    }
    if (await isUserBusy(userId, call.id)) {
        emitToParticipants(call.participants.map((item) => item.userId), "call:busy", { callId: call.id, userId });
        throw new errorHandler_1.AppError(409, "User is busy", { code: "busy" });
    }
    const now = new Date();
    await setParticipantStatus(call.id, userId, "accepted", {
        joinedAt: now,
        deviceInfo,
    });
    const runtime = runtimeCalls.get(call.id);
    if (runtime) {
        runtime.heartbeat.set(userId, Date.now());
        runtime.status = call_types_1.CALL_STATE.ACCEPTED;
    }
    const acceptedCount = await prismaAny.callParticipant?.count?.({
        where: {
            callId: call.id,
            status: "accepted",
        },
    });
    if (acceptedCount >= 2) {
        await updateCallStatus(call.id, call_types_1.CALL_STATE.IN_PROGRESS, { startedAt: now, connectedAt: now });
        if (runtime?.ringTimeout)
            clearTimeout(runtime.ringTimeout);
        emitToParticipants(call.participants.map((item) => item.userId), "call:accepted", {
            callId: call.id,
            acceptedBy: userId,
            state: call_types_1.CALL_STATE.IN_PROGRESS,
            startedAt: now.toISOString(),
        });
    }
    else {
        await updateCallStatus(call.id, call_types_1.CALL_STATE.ACCEPTED, { startedAt: now });
        emitToParticipants(call.participants.map((item) => item.userId), "call:accepted", {
            callId: call.id,
            acceptedBy: userId,
            state: call_types_1.CALL_STATE.ACCEPTED,
            startedAt: now.toISOString(),
        });
    }
    await logCallEvent(call.id, userId, "CALL_ACCEPTED", {});
};
const declineCall = async (userId, payload) => {
    assertCallingEnabled();
    const call = await validateCallAccess(payload.callId, userId);
    if (call.status !== call_types_1.CALL_STATE.RINGING && call.status !== call_types_1.CALL_STATE.ACCEPTED) {
        throw new errorHandler_1.AppError(409, "Call cannot be declined in current state");
    }
    await setParticipantStatus(call.id, userId, "declined", {
        leftAt: new Date(),
    });
    await updateCallStatus(call.id, call_types_1.CALL_STATE.DECLINED, { endedAt: new Date() });
    await logCallEvent(call.id, userId, "CALL_DECLINED", {});
    emitToParticipants(call.participants.map((item) => item.userId), "call:declined", { callId: call.id, declinedBy: userId, state: call_types_1.CALL_STATE.DECLINED });
    await endCallInternal(call.id, userId, call_types_1.CALL_STATE.DECLINED);
};
const cancelCall = async (userId, payload) => {
    const call = await validateCallAccess(payload.callId, userId);
    if (call.createdBy !== userId) {
        throw new errorHandler_1.AppError(403, "Only caller can cancel the ringing call");
    }
    if (call.status !== call_types_1.CALL_STATE.RINGING) {
        throw new errorHandler_1.AppError(409, "Call can only be canceled while ringing");
    }
    await logCallEvent(call.id, userId, "CALL_CANCELED", {});
    await endCallInternal(call.id, userId, call_types_1.CALL_STATE.ENDED);
};
const endCall = async (userId, payload) => {
    const call = await validateCallAccess(payload.callId, userId);
    if (call.status !== call_types_1.CALL_STATE.RINGING &&
        call.status !== call_types_1.CALL_STATE.ACCEPTED &&
        call.status !== call_types_1.CALL_STATE.IN_PROGRESS) {
        throw new errorHandler_1.AppError(409, "Call already ended");
    }
    await logCallEvent(call.id, userId, "CALL_ENDED_BY_USER", {});
    await endCallInternal(call.id, userId, call_types_1.CALL_STATE.ENDED);
};
const heartbeat = async (userId, payload) => {
    const call = await validateCallAccess(payload.callId, userId);
    const runtime = runtimeCalls.get(call.id);
    if (!runtime)
        return;
    runtime.heartbeat.set(userId, payload.ts ?? Date.now());
    const disconnectTimer = runtime.disconnectTimers.get(userId);
    if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        runtime.disconnectTimers.delete(userId);
    }
};
const relayWebRtc = async (fromUserId, event, payload) => {
    if (!payload.callId || !payload.toUserId) {
        throw new errorHandler_1.AppError(400, "Invalid payload");
    }
    const call = await validateCallAccess(payload.callId, fromUserId);
    if (call.isGroup || call.sfuProvider === "LIVEKIT") {
        throw new errorHandler_1.AppError(409, "WebRTC relay is disabled for SFU group calls", {
            code: "state-conflict",
        });
    }
    const isTargetParticipant = call.participants.some((item) => item.userId === payload.toUserId);
    if (!isTargetParticipant)
        throw new errorHandler_1.AppError(403, "Target is not a call participant");
    emitToUser(payload.toUserId, event, {
        callId: payload.callId,
        fromUserId,
        toUserId: payload.toUserId,
        sdp: payload.sdp,
        candidate: payload.candidate,
        meta: payload.meta ?? {},
    });
};
const sfuJoin = async (userId, callId) => {
    assertCallingEnabled();
    checkSfuJoinRateLimit(userId);
    const call = await validateCallAccess(callId, userId);
    await assertCallingFeature(userId, "GROUP_CALLING");
    if (!call.isGroup)
        throw new errorHandler_1.AppError(400, "SFU join only supported for group calls");
    if (call.sfuProvider !== "LIVEKIT")
        throw new errorHandler_1.AppError(400, "Call is not configured for LiveKit");
    if (!call.chatId)
        throw new errorHandler_1.AppError(400, "Missing group chat context");
    await chat_service_1.chatService.assertParticipant(userId, call.chatId);
    if ([call_types_1.CALL_STATE.ENDED, call_types_1.CALL_STATE.DECLINED, call_types_1.CALL_STATE.FAILED, call_types_1.CALL_STATE.TIMEOUT].includes(call.status)) {
        throw new errorHandler_1.AppError(409, "Call is not active");
    }
    const roomName = livekit_service_1.livekitService.normalizeRoomName(call.id);
    await livekit_service_1.livekitService.ensureRoom(roomName);
    await prismaAny.callSession?.update?.({
        where: { id: call.id },
        data: {
            roomName,
            status: call.status === call_types_1.CALL_STATE.RINGING ? call_types_1.CALL_STATE.IN_PROGRESS : undefined,
            startedAt: call.startedAt ?? new Date(),
            connectedAt: call.connectedAt ?? new Date(),
        },
    });
    await prismaAny.callParticipant?.updateMany?.({
        where: { callId: call.id, userId },
        data: {
            status: "accepted",
            joinMethod: "JOIN",
            joinedAt: new Date(),
            leftAt: null,
        },
    });
    const token = await livekit_service_1.livekitService.mintJoinToken({
        roomName,
        userId,
        name: userId,
        canPublish: true,
        canSubscribe: true,
    });
    await logCallEvent(call.id, userId, "sfu_token_issued", {
        provider: "LIVEKIT",
        roomName,
    });
    await logCallEvent(call.id, userId, "participant_connected", {
        provider: "LIVEKIT",
        roomName,
    });
    return {
        callId: call.id,
        roomName,
        livekitUrl: token.livekitUrl,
        token: token.token,
    };
};
const sfuLeave = async (userId, callId) => {
    const call = await validateCallAccess(callId, userId);
    if (!call.isGroup)
        throw new errorHandler_1.AppError(400, "SFU leave only supported for group calls");
    await prismaAny.callParticipant?.updateMany?.({
        where: { callId, userId },
        data: {
            leftAt: new Date(),
            status: "ended",
        },
    });
    await logCallEvent(callId, userId, "participant_disconnected", {
        provider: call.sfuProvider,
        roomName: call.roomName ?? livekit_service_1.livekitService.normalizeRoomName(callId),
    });
    const connectedCount = await prismaAny.callParticipant?.count?.({
        where: { callId, leftAt: null },
    });
    if (!connectedCount) {
        await endCallInternal(callId, userId, call_types_1.CALL_STATE.ENDED);
    }
};
const sfuEnd = async (userId, callId) => {
    const call = await validateCallAccess(callId, userId);
    if (!call.isGroup)
        throw new errorHandler_1.AppError(400, "SFU end only supported for group calls");
    if (call.hostUserId !== userId && call.createdBy !== userId) {
        throw new errorHandler_1.AppError(403, "Only host can end group call");
    }
    if (call.roomName) {
        await livekit_service_1.livekitService.deleteRoom(call.roomName).catch(() => undefined);
    }
    await endCallInternal(callId, userId, call_types_1.CALL_STATE.ENDED);
};
const handleLivekitWebhook = async (rawBody, authHeader) => {
    const event = await livekit_service_1.livekitService.verifyWebhookEvent(rawBody, authHeader);
    const roomName = event.room?.name;
    const identity = event.participant?.identity;
    if (!roomName || !identity)
        return { ok: true };
    const call = await prismaAny.callSession?.findFirst?.({
        where: { roomName },
        select: { id: true, isGroup: true, sfuProvider: true },
    });
    if (!call || !call.isGroup || call.sfuProvider !== "LIVEKIT")
        return { ok: true };
    const eventType = (event.event ?? "").toLowerCase();
    if (eventType.includes("participant_joined") || eventType.includes("participant_connected")) {
        await prismaAny.callSession?.update?.({
            where: { id: call.id },
            data: {
                status: "in_progress",
                connectedAt: new Date(),
                region: event.room?.metadata ? String(event.room.metadata).slice(0, 120) : undefined,
            },
        });
        await prismaAny.callParticipant?.updateMany?.({
            where: { callId: call.id, userId: identity },
            data: { joinedAt: new Date(), leftAt: null, status: "accepted" },
        });
        await logCallEvent(call.id, identity, "participant_connected", { provider: "LIVEKIT", roomName });
    }
    if (eventType.includes("participant_left") || eventType.includes("participant_disconnected")) {
        await prismaAny.callParticipant?.updateMany?.({
            where: { callId: call.id, userId: identity },
            data: { leftAt: new Date(), status: "ended" },
        });
        await logCallEvent(call.id, identity, "participant_disconnected", {
            provider: "LIVEKIT",
            roomName,
        });
    }
    return { ok: true };
};
const onSocketDisconnect = async (userId) => {
    const callId = userActiveCall.get(userId);
    if (!callId)
        return;
    const runtime = runtimeCalls.get(callId);
    if (!runtime)
        return;
    if (runtime.status !== call_types_1.CALL_STATE.IN_PROGRESS && runtime.status !== call_types_1.CALL_STATE.ACCEPTED)
        return;
    const existing = runtime.disconnectTimers.get(userId);
    if (existing)
        clearTimeout(existing);
    const timer = setTimeout(async () => {
        await logCallEvent(callId, userId, "DISCONNECT_TIMEOUT", {
            disconnectedAt: nowIso(),
        });
        await prismaAny.callSession?.update?.({
            where: { id: callId },
            data: { failureReason: "dropped_disconnect_timeout" },
        });
        await endCallInternal(callId, userId, call_types_1.CALL_STATE.FAILED);
    }, DISCONNECT_GRACE_MS);
    runtime.disconnectTimers.set(userId, timer);
};
const onSocketConnect = (userId) => {
    const callId = userActiveCall.get(userId);
    if (!callId)
        return;
    const runtime = runtimeCalls.get(callId);
    if (!runtime)
        return;
    const timer = runtime.disconnectTimers.get(userId);
    if (!timer)
        return;
    clearTimeout(timer);
    runtime.disconnectTimers.delete(userId);
    emitToParticipants(runtime.participants, "call:ringing", {
        callId,
        state: runtime.status,
        reconnectedUserId: userId,
    });
};
const getCallById = async (userId, callId) => {
    const call = await validateCallAccess(callId, userId);
    return {
        id: call.id,
        type: call.type,
        isGroup: Boolean(call.isGroup),
        chatId: call.chatId ?? null,
        createdBy: call.createdBy,
        status: mapDbStatusToCallState(call.status),
        startedAt: call.startedAt ? new Date(call.startedAt).toISOString() : null,
        endedAt: call.endedAt ? new Date(call.endedAt).toISOString() : null,
        createdAt: new Date(call.createdAt).toISOString(),
        updatedAt: new Date(call.updatedAt).toISOString(),
        participants: call.participants.map((participant) => ({
            userId: participant.userId,
            role: participant.role,
            status: participant.status,
            joinedAt: participant.joinedAt ? new Date(participant.joinedAt).toISOString() : null,
            leftAt: participant.leftAt ? new Date(participant.leftAt).toISOString() : null,
        })),
    };
};
const getCallHistory = async (input) => {
    const take = Math.max(1, Math.min(input.limit ?? 20, 50));
    const rows = await prismaAny.callParticipant?.findMany?.({
        where: {
            userId: input.userId,
            ...(input.filter === "missed" ? { status: "missed" } : {}),
        },
        include: {
            callSession: {
                include: {
                    participants: {
                        select: {
                            userId: true,
                            status: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            callSession: { createdAt: "desc" },
        },
        take: take + 1,
        ...(input.cursor
            ? {
                cursor: { id: input.cursor },
                skip: 1,
            }
            : {}),
    });
    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;
    return {
        items: items.map((entry) => {
            const session = entry.callSession;
            const direction = session.createdBy === input.userId ? "outgoing" : "incoming";
            const participantIds = session.participants.map((item) => item.userId);
            const durationSec = session.startedAt && session.endedAt
                ? Math.max(0, Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000))
                : 0;
            return {
                callId: session.id,
                type: session.type,
                isGroup: Boolean(session.isGroup),
                status: session.status,
                participantStatus: entry.status,
                direction,
                participants: participantIds,
                durationSec,
                startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
                endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : null,
                createdAt: new Date(session.createdAt).toISOString(),
            };
        }),
        nextCursor,
    };
};
exports.callService = {
    isPaidUser: (userId) => featureGate_service_1.featureGateService.canUseFeature(userId, "CALLING"),
    assertPaidUser: (userId) => assertCallingFeature(userId, "CALLING"),
    startCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    heartbeat,
    relayWebRtc,
    onSocketDisconnect,
    onSocketConnect,
    getCallById,
    getCallHistory,
    sfuJoin,
    sfuLeave,
    sfuEnd,
    handleLivekitWebhook,
};
