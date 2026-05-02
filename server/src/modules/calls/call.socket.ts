import { AppError } from "../../middlewares/errorHandler";
import type { AuthenticatedSocket, IOServer } from "../../socket";
import { callService } from "./call.service";
import type {
  CallActionPayload,
  CallHeartbeatPayload,
  StartCallSocketPayload,
  WebRtcRelayPayload,
} from "./call.types";

const mapErrorCode = (error: unknown) => {
  if (error instanceof AppError) {
    const details = error.details as { code?: string } | undefined;
    if (typeof details?.code === "string") return details.code;
    if (error.statusCode === 402) return "paid-required";
    if (error.statusCode === 403) return "forbidden";
    if (error.statusCode === 404) return "not-found";
    if (error.statusCode === 429) return "rate-limited";
    if (error.statusCode === 409) return "state-conflict";
    return "invalid-payload";
  }
  return "server-error";
};

const emitCallError = (socket: AuthenticatedSocket, error: unknown, callId?: string) => {
  const code = mapErrorCode(error);
  const message = error instanceof Error ? error.message : "Call operation failed";
  socket.emit("call:error", { code, message, ...(callId ? { callId } : {}) });
};

const withSocketGuard = (
  socket: AuthenticatedSocket,
  handler: () => Promise<void>,
  callId?: string
) => {
  void handler().catch((error) => {
    emitCallError(socket, error, callId);
  });
};

export const registerCallSocketEvents = (_io: IOServer, socket: AuthenticatedSocket) => {
  const currentUserId = socket.data.user.id;

  socket.on("call:start", (payload: StartCallSocketPayload) => {
    withSocketGuard(socket, async () => {
      await callService.startCall(currentUserId, payload);
    });
  });

  socket.on("call:cancel", (payload: CallActionPayload) => {
    withSocketGuard(socket, async () => {
      await callService.cancelCall(currentUserId, payload);
    }, payload?.callId);
  });

  socket.on("call:accept", (payload: CallActionPayload) => {
    withSocketGuard(socket, async () => {
      await callService.acceptCall(currentUserId, payload);
    }, payload?.callId);
  });

  socket.on("call:decline", (payload: CallActionPayload) => {
    withSocketGuard(socket, async () => {
      await callService.declineCall(currentUserId, payload);
    }, payload?.callId);
  });

  socket.on("call:end", (payload: CallActionPayload) => {
    withSocketGuard(socket, async () => {
      await callService.endCall(currentUserId, payload);
    }, payload?.callId);
  });

  socket.on("webrtc:offer", (payload: WebRtcRelayPayload) => {
    withSocketGuard(socket, async () => {
      await callService.relayWebRtc(currentUserId, "webrtc:offer", payload);
    }, payload?.callId);
  });

  socket.on("webrtc:answer", (payload: WebRtcRelayPayload) => {
    withSocketGuard(socket, async () => {
      await callService.relayWebRtc(currentUserId, "webrtc:answer", payload);
    }, payload?.callId);
  });

  socket.on("webrtc:ice", (payload: WebRtcRelayPayload) => {
    withSocketGuard(socket, async () => {
      await callService.relayWebRtc(currentUserId, "webrtc:ice", payload);
    }, payload?.callId);
  });

  socket.on("webrtc:renegotiate", (payload: WebRtcRelayPayload) => {
    withSocketGuard(socket, async () => {
      await callService.relayWebRtc(currentUserId, "webrtc:renegotiate", payload);
    }, payload?.callId);
  });

  socket.on("call:heartbeat", (payload: CallHeartbeatPayload) => {
    withSocketGuard(socket, async () => {
      await callService.heartbeat(currentUserId, payload);
    }, payload?.callId);
  });
};
