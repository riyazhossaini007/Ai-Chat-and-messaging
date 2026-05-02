import { env } from "../../../config/env";
import { AppError } from "../../../middlewares/errorHandler";

const LIVEKIT_SERVER_SDK_MODULE = "livekit-server-sdk";

type WebhookEvent = {
  event?: string;
  room?: { name?: string };
  participant?: { identity?: string; name?: string };
};

const requireLivekitConfig = () => {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new AppError(500, "LiveKit is not configured");
  }
};

const normalizeRoomName = (callId: string) => `call_${callId}`;

const loadSdk = async () => {
  const moduleName: string = LIVEKIT_SERVER_SDK_MODULE;
  const sdk = (await import(moduleName)) as any;
  return sdk;
};

const ensureRoom = async (roomName: string) => {
  requireLivekitConfig();
  const sdk = await loadSdk();
  const roomService = new sdk.RoomServiceClient(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET
  );
  await roomService.createRoom({
    name: roomName,
    emptyTimeout: 10 * 60,
    maxParticipants: 100,
  });
  return { roomName };
};

const deleteRoom = async (roomName: string) => {
  requireLivekitConfig();
  const sdk = await loadSdk();
  const roomService = new sdk.RoomServiceClient(
    env.LIVEKIT_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET
  );
  try {
    await roomService.deleteRoom(roomName);
  } catch {
    return;
  }
};

const mintJoinToken = async (input: {
  roomName: string;
  userId: string;
  name?: string | null;
  canPublish?: boolean;
  canSubscribe?: boolean;
}) => {
  requireLivekitConfig();
  const sdk = await loadSdk();
  const token = new sdk.AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
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
    livekitUrl: env.LIVEKIT_URL,
    token: await token.toJwt(),
    roomName: input.roomName,
  };
};

const verifyWebhookEvent = async (rawBody: Buffer, authHeader: string | undefined) => {
  requireLivekitConfig();
  const sdk = await loadSdk();
  const receiver = new sdk.WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  const payload = await receiver.receive(rawBody.toString("utf-8"), authHeader ?? "");
  return payload as WebhookEvent;
};

export const livekitService = {
  normalizeRoomName,
  ensureRoom,
  deleteRoom,
  mintJoinToken,
  verifyWebhookEvent,
};
