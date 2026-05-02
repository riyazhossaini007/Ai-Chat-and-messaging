import type { Socket } from "socket.io-client";
import { useAuthStore } from "../../stores/authStore";
import { useCallStore } from "./callStore";
import { webrtcManager } from "./webrtc";

type CallSocket = Socket;

let heartbeatTimer: number | null = null;
let activeSocket: CallSocket | null = null;

const beginHeartbeat = (callId: string) => {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
  }
  heartbeatTimer = window.setInterval(() => {
    if (!activeSocket || !useAuthStore.getState().token) return;
    activeSocket.emit("call:heartbeat", { callId, ts: Date.now() });
  }, 4000);
};

const stopHeartbeat = () => {
  if (!heartbeatTimer) return;
  window.clearInterval(heartbeatTimer);
  heartbeatTimer = null;
};

export const registerCallSocketHandlers = (socket: CallSocket) => {
  activeSocket = socket;

  webrtcManager.setSignalSender((event, payload) => {
    socket.emit(event, payload);
  });
  webrtcManager.setRemoteStreamHandler((userId, stream) => {
    useCallStore.getState().setRemoteStream(userId, stream);
  });
  webrtcManager.setPeerStateHandler((userId, state) => {
    if (state === "failed" || state === "disconnected") {
      useCallStore.getState().upsertToast(`Connection issue with ${userId}`, "danger");
    }
  });

  const onIncoming = (payload: {
    callId: string;
    fromUserId: string;
    type: "VOICE" | "VIDEO";
    isGroup: boolean;
    chatId: string | null;
    participants: string[];
    state: string;
  }) => {
    useCallStore.getState().setIncoming({
      callId: payload.callId,
      type: payload.type,
      isGroup: payload.isGroup,
      chatId: payload.chatId,
      participants: payload.participants,
      phase: "incoming",
      state: payload.state,
      startedAt: null,
      incomingFromUserId: payload.fromUserId,
    });
  };

  const onRinging = (payload: {
    callId: string;
    type?: "VOICE" | "VIDEO";
    isGroup?: boolean;
    chatId?: string | null;
    participants?: string[];
    state: string;
  }) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const active = useCallStore.getState().activeCall;
    if (active?.callId === payload.callId) {
      useCallStore.getState().setActiveCall({
        ...active,
        phase: "outgoing",
        state: payload.state,
      });
      return;
    }
    useCallStore.getState().setActiveCall({
      callId: payload.callId,
      type: payload.type ?? "VOICE",
      isGroup: payload.isGroup ?? (payload.participants?.length ?? 0) > 2,
      chatId: payload.chatId ?? null,
      participants: payload.participants ?? [userId],
      phase: "outgoing",
      state: payload.state,
      startedAt: null,
    });
  };

  const onAccepted = (payload: {
    callId: string;
    acceptedBy: string;
    state: string;
    startedAt: string;
  }) => {
    const store = useCallStore.getState();
    const active = store.activeCall ?? store.incoming;
    if (!active || active.callId !== payload.callId) return;
    const localUserId = useAuthStore.getState().user?.id;
    if (!localUserId) return;

    if (!(active.isGroup && active.type === "VIDEO")) {
      void webrtcManager.initSession({ callId: payload.callId, localUserId });
      const peers = active.participants.filter((id) => id !== localUserId);
      peers.forEach((peerUserId) => {
        void webrtcManager.createOffer(peerUserId);
      });
    }

    store.setIncoming(null);
    store.setActiveCall({
      ...active,
      phase: "in_call",
      state: payload.state,
      startedAt: payload.startedAt,
    });
    if (active.isGroup && active.type === "VIDEO") {
      void store.joinSfuRoom(payload.callId).catch(() => {
        store.upsertToast("Failed to join SFU room", "danger");
      });
    }
    beginHeartbeat(payload.callId);
  };

  const onDeclined = () => {
    const store = useCallStore.getState();
    store.upsertToast("Call declined", "danger");
    stopHeartbeat();
    void store.resetCallState();
  };

  const onBusy = () => {
    const store = useCallStore.getState();
    store.upsertToast("User is busy right now", "danger");
    stopHeartbeat();
    void store.resetCallState();
  };

  const onFailed = (payload: { reason: string }) => {
    const store = useCallStore.getState();
    store.upsertToast(`Call failed: ${payload.reason}`, "danger");
    stopHeartbeat();
    void store.resetCallState();
  };

  const onEnded = () => {
    stopHeartbeat();
    void useCallStore.getState().resetCallState();
  };

  const onMissed = () => {
    const store = useCallStore.getState();
    store.upsertToast("Missed call", "danger");
    stopHeartbeat();
    void store.resetCallState();
  };

  const onCallError = (payload: { code: string; message: string }) => {
    const store = useCallStore.getState();
    if (payload.code === "paid-required") {
      store.openUpgradeModal();
      return;
    }
    store.upsertToast(payload.message, "danger");
  };

  const onOffer = (payload: { callId: string; fromUserId: string; sdp?: RTCSessionDescriptionInit }) => {
    void webrtcManager.handleOffer(payload);
  };
  const onAnswer = (payload: { fromUserId: string; sdp?: RTCSessionDescriptionInit }) => {
    void webrtcManager.handleAnswer(payload);
  };
  const onIce = (payload: { fromUserId: string; candidate?: RTCIceCandidateInit }) => {
    void webrtcManager.handleIce(payload);
  };
  const onRenegotiate = (payload: { callId: string; fromUserId: string; sdp?: RTCSessionDescriptionInit }) => {
    void webrtcManager.handleOffer(payload);
  };

  socket.on("call:incoming", onIncoming);
  socket.on("call:ringing", onRinging);
  socket.on("call:accepted", onAccepted);
  socket.on("call:declined", onDeclined);
  socket.on("call:busy", onBusy);
  socket.on("call:failed", onFailed);
  socket.on("call:ended", onEnded);
  socket.on("call:missed", onMissed);
  socket.on("call:error", onCallError);
  socket.on("webrtc:offer", onOffer);
  socket.on("webrtc:answer", onAnswer);
  socket.on("webrtc:ice", onIce);
  socket.on("webrtc:renegotiate", onRenegotiate);

  return () => {
    activeSocket = null;
    stopHeartbeat();
    socket.off("call:incoming", onIncoming);
    socket.off("call:ringing", onRinging);
    socket.off("call:accepted", onAccepted);
    socket.off("call:declined", onDeclined);
    socket.off("call:busy", onBusy);
    socket.off("call:failed", onFailed);
    socket.off("call:ended", onEnded);
    socket.off("call:missed", onMissed);
    socket.off("call:error", onCallError);
    socket.off("webrtc:offer", onOffer);
    socket.off("webrtc:answer", onAnswer);
    socket.off("webrtc:ice", onIce);
    socket.off("webrtc:renegotiate", onRenegotiate);
  };
};
