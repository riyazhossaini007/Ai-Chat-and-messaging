export const CALL_STATE = {
  IDLE: "idle",
  RINGING: "ringing",
  ACCEPTED: "accepted",
  IN_PROGRESS: "in_progress",
  ENDED: "ended",
  MISSED: "missed",
  DECLINED: "declined",
  FAILED: "failed",
  BUSY: "busy",
  TIMEOUT: "timeout",
} as const;

export type CallState = (typeof CALL_STATE)[keyof typeof CALL_STATE];

export type CallType = "VOICE" | "VIDEO";

export type ParticipantRole = "CALLER" | "CALLEE";

export type ParticipantCallStatus =
  | "accepted"
  | "declined"
  | "missed"
  | "busy"
  | "ended"
  | "ringing";

export type CallErrorCode =
  | "paid-required"
  | "feature-disabled"
  | "not-found"
  | "forbidden"
  | "busy"
  | "invalid-payload"
  | "rate-limited"
  | "state-conflict"
  | "server-error";

export type DeviceInfo = {
  cameraId?: string;
  microphoneId?: string;
  speakerId?: string;
  userAgent?: string;
};

export type StartCallInput = {
  type: CallType;
  peerUserId?: string;
  chatId?: string;
  isGroup?: boolean;
  deviceInfo?: DeviceInfo;
};

export type StartCallResult = {
  callId: string;
  state: CallState;
  participants: string[];
  expiresAt: string;
};

export type CallParticipantView = {
  userId: string;
  role: ParticipantRole;
  status: ParticipantCallStatus;
  joinedAt: string | null;
  leftAt: string | null;
};

export type CallDetails = {
  id: string;
  type: CallType;
  isGroup: boolean;
  chatId: string | null;
  createdBy: string;
  status: CallState;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: CallParticipantView[];
};

export type StartCallSocketPayload = StartCallInput;

export type CallActionPayload = {
  callId: string;
};

export type WebRtcRelayPayload = {
  callId: string;
  toUserId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  meta?: Record<string, unknown>;
};

export type CallHeartbeatPayload = {
  callId: string;
  ts?: number;
};

export type CallIncomingPayload = {
  callId: string;
  fromUserId: string;
  type: CallType;
  isGroup: boolean;
  chatId: string | null;
  participants: string[];
  state: CallState;
  expiresAt: string;
};

export type CallErrorPayload = {
  code: CallErrorCode;
  message: string;
  callId?: string;
};
