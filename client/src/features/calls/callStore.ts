import { create } from "zustand";
import { api, getApiErrorMessage } from "../../api/api";
import { getSocket } from "../../lib/socket";
import { useAuthStore } from "../../stores/authStore";
import { withDevtools } from "../../stores/storeUtils";
import { webrtcManager } from "./webrtc";
import { livekitClient } from "./sfu/livekitClient";

export type CallKind = "VOICE" | "VIDEO";
export type CallUiPhase = "idle" | "incoming" | "outgoing" | "in_call";
export type HistoryFilter = "all" | "missed";

export type ActiveCall = {
  callId: string;
  type: CallKind;
  isGroup: boolean;
  chatId: string | null;
  participants: string[];
  phase: CallUiPhase;
  state: string;
  startedAt: string | null;
  incomingFromUserId?: string;
};

export type CallHistoryItem = {
  callId: string;
  type: CallKind;
  isGroup: boolean;
  status: string;
  participantStatus: string;
  direction: "incoming" | "outgoing";
  participants: string[];
  durationSec: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

type ToastTone = "info" | "danger";

type CallToast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type CallDevices = {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  selectedCameraId?: string;
  selectedMicrophoneId?: string;
  selectedSpeakerId?: string;
  noiseSuppressionSupported: boolean;
  autoStartVideo: boolean;
  noiseSuppressionEnabled: boolean;
};

type CallStore = {
  activeCall: ActiveCall | null;
  incoming: ActiveCall | null;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isSpeakerEnabled: boolean;
  isCallHistoryOpen: boolean;
  isCallSettingsOpen: boolean;
  historyFilter: HistoryFilter;
  history: CallHistoryItem[];
  historyNextCursor: string | null;
  historyLoading: boolean;
  showUpgradeModal: boolean;
  micLevel: number;
  toasts: CallToast[];
  devices: CallDevices;
  sfuConnectedCallId: string | null;
  upsertToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
  setIncoming: (payload: ActiveCall | null) => void;
  setActiveCall: (payload: ActiveCall | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (userId: string, stream: MediaStream | null) => void;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  openCallHistory: () => void;
  closeCallHistory: () => void;
  openCallSettings: () => void;
  closeCallSettings: () => void;
  setHistoryFilter: (filter: HistoryFilter) => void;
  fetchHistory: (refresh?: boolean) => Promise<void>;
  startCall: (input: {
    type: CallKind;
    peerUserId?: string;
    chatId?: string;
    isGroup?: boolean;
  }) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  joinSfuRoom: (callId: string) => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  endCurrentCall: () => Promise<void>;
  toggleMic: () => void;
  toggleCamera: () => Promise<void>;
  toggleSpeaker: () => void;
  switchCamera: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  setDevice: (kind: "camera" | "microphone" | "speaker", deviceId: string) => Promise<void>;
  setAutoStartVideo: (enabled: boolean) => void;
  setNoiseSuppression: (enabled: boolean) => Promise<void>;
  startMicTest: () => Promise<void>;
  stopMicTest: () => void;
  resetCallState: () => Promise<void>;
};

let micAnalyzerRaf: number | null = null;
let micAnalyzerCtx: AudioContext | null = null;
let micAnalyzerStream: MediaStream | null = null;
let sfuReconnectTimer: number | null = null;

const nextToastId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const clearSfuReconnectTimer = () => {
  if (!sfuReconnectTimer) return;
  window.clearTimeout(sfuReconnectTimer);
  sfuReconnectTimer = null;
};

const isCallingEnabledClient = () => (import.meta.env.VITE_CALLING_ENABLED ?? "1") === "1";

const enumerateCallDevices = async (): Promise<CallDevices> => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === "videoinput");
  const microphones = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");
  const supported = navigator.mediaDevices.getSupportedConstraints();
  const storedAutoVideo = window.localStorage.getItem("call:autoVideo");
  const storedNoise = window.localStorage.getItem("call:noiseSuppression");
  const storedCamera = window.localStorage.getItem("call:cameraId") ?? undefined;
  const storedMic = window.localStorage.getItem("call:microphoneId") ?? undefined;
  const storedSpeaker = window.localStorage.getItem("call:speakerId") ?? undefined;

  return {
    cameras,
    microphones,
    speakers,
    selectedCameraId: storedCamera ?? cameras[0]?.deviceId,
    selectedMicrophoneId: storedMic ?? microphones[0]?.deviceId,
    selectedSpeakerId: storedSpeaker ?? speakers[0]?.deviceId,
    noiseSuppressionSupported: Boolean(supported.noiseSuppression),
    autoStartVideo: storedAutoVideo === null ? true : storedAutoVideo === "1",
    noiseSuppressionEnabled: storedNoise === null ? true : storedNoise === "1",
  };
};

const ensureLocalMedia = async (
  type: CallKind,
  devices: CallDevices,
  forceVideo = false
) => {
  const wantsVideo = type === "VIDEO" && (forceVideo || devices.autoStartVideo);
  const stream = await webrtcManager.ensureLocalStream({
    video: wantsVideo
      ? {
          deviceId: devices.selectedCameraId ? { exact: devices.selectedCameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      : false,
    audio: {
      deviceId: devices.selectedMicrophoneId ? { exact: devices.selectedMicrophoneId } : undefined,
      noiseSuppression: devices.noiseSuppressionEnabled,
      echoCancellation: true,
    },
  });
  return stream;
};

export const useCallStore = create<CallStore>()(
  withDevtools(
    (set, get) => ({
      activeCall: null,
      incoming: null,
      localStream: null,
      remoteStreams: {},
      isMicEnabled: true,
      isCameraEnabled: true,
      isSpeakerEnabled: true,
      isCallHistoryOpen: false,
      isCallSettingsOpen: false,
      historyFilter: "all",
      history: [],
      historyNextCursor: null,
      historyLoading: false,
      showUpgradeModal: false,
      micLevel: 0,
      toasts: [],
      devices: {
        cameras: [],
        microphones: [],
        speakers: [],
        noiseSuppressionSupported: false,
        autoStartVideo: true,
        noiseSuppressionEnabled: true,
      },
      sfuConnectedCallId: null,

      upsertToast: (message, tone = "info") => {
        const id = nextToastId();
        set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
        window.setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
        }, 3200);
      },

      dismissToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
      },

      setIncoming: (payload) => set({ incoming: payload }),
      setActiveCall: (payload) => set({ activeCall: payload }),
      setLocalStream: (stream) => set({ localStream: stream }),
      setRemoteStream: (userId, stream) =>
        set((state) => {
          const next = { ...state.remoteStreams };
          if (!stream) {
            delete next[userId];
          } else {
            next[userId] = stream;
          }
          return { remoteStreams: next };
        }),
      openUpgradeModal: () => set({ showUpgradeModal: true }),
      closeUpgradeModal: () => set({ showUpgradeModal: false }),
      openCallHistory: () => set({ isCallHistoryOpen: true }),
      closeCallHistory: () => set({ isCallHistoryOpen: false }),
      openCallSettings: () => set({ isCallSettingsOpen: true }),
      closeCallSettings: () => set({ isCallSettingsOpen: false }),
      setHistoryFilter: (filter) => set({ historyFilter: filter }),

      fetchHistory: async (refresh = false) => {
        if (get().historyLoading) return;
        set({ historyLoading: true });
        try {
          const cursor = refresh ? undefined : get().historyNextCursor ?? undefined;
          const response = await api.get<{
            data: {
              items: CallHistoryItem[];
              nextCursor: string | null;
            };
          }>("/calls/history", {
            params: {
              cursor,
              limit: 20,
              filter: get().historyFilter,
            },
          });
          const items = response.data.data.items ?? [];
          set((state) => ({
            history: refresh ? items : [...state.history, ...items],
            historyNextCursor: response.data.data.nextCursor ?? null,
          }));
        } catch (error) {
          get().upsertToast(getApiErrorMessage(error), "danger");
        } finally {
          set({ historyLoading: false });
        }
      },

      startCall: async (input) => {
        const authUser = useAuthStore.getState().user;
        if (!authUser) return;
        if (!isCallingEnabledClient()) {
          get().upsertToast("Calling is currently disabled", "danger");
          return;
        }
        if (!authUser.subscriptionActive) {
          set({ showUpgradeModal: true });
          return;
        }

        try {
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit("call:start", input);
          } else {
            const response = await api.post<{ data: { callId: string } }>("/calls/start", input);
            const callId = response.data.data.callId;
            set({
              activeCall: {
                callId,
                type: input.type,
                isGroup: Boolean(input.isGroup),
                chatId: input.chatId ?? null,
                participants: input.peerUserId ? [authUser.id, input.peerUserId] : [authUser.id],
                phase: "outgoing",
                state: "ringing",
                startedAt: null,
              },
            });
          }
        } catch (error) {
          const message = getApiErrorMessage(error);
          if (/paid/i.test(message)) {
            set({ showUpgradeModal: true });
          }
          get().upsertToast(message, "danger");
        }
      },

      acceptIncomingCall: async () => {
        const incoming = get().incoming;
        const user = useAuthStore.getState().user;
        if (!incoming || !user) return;
        if (!user.subscriptionActive) {
          set({ showUpgradeModal: true });
          return;
        }
        try {
          let stream: MediaStream | null = null;
          if (!(incoming.isGroup && incoming.type === "VIDEO")) {
            await webrtcManager.initSession({ callId: incoming.callId, localUserId: user.id });
            stream = await ensureLocalMedia(incoming.type, get().devices);
          }
          set({
            localStream: stream,
            activeCall: {
              ...incoming,
              phase: "in_call",
              state: "accepted",
              startedAt: new Date().toISOString(),
            },
            incoming: null,
            isMicEnabled: true,
            isCameraEnabled: incoming.type === "VIDEO",
          });
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit("call:accept", { callId: incoming.callId });
          } else {
            await api.post(`/calls/${incoming.callId}/accept`);
          }

          if (incoming.isGroup && incoming.type === "VIDEO") {
            await get().joinSfuRoom(incoming.callId);
          }
        } catch (error) {
          get().upsertToast(getApiErrorMessage(error), "danger");
        }
      },

      joinSfuRoom: async (callId: string) => {
        if (get().sfuConnectedCallId === callId) return;
        const join = await api.post<{
          data: { livekitUrl: string; token: string; roomName: string; callId: string };
        }>(`/calls/${callId}/sfu/join`);
        await livekitClient.connect({
          livekitUrl: join.data.data.livekitUrl,
          token: join.data.data.token,
          onParticipantConnected: (identity, track) => {
            if (!track) return;
            const remote = new MediaStream([track]);
            get().setRemoteStream(identity, remote);
          },
          onParticipantDisconnected: (identity) => {
            get().setRemoteStream(identity, null);
          },
          onSignalReconnecting: () => {
            get().upsertToast("Reconnecting to SFU...", "info");
            clearSfuReconnectTimer();
            sfuReconnectTimer = window.setTimeout(async () => {
              get().upsertToast("LiveKit reconnect timed out", "danger");
              await get().endCurrentCall();
            }, 10_000);
          },
          onSignalReconnected: () => {
            clearSfuReconnectTimer();
          },
          onDisconnected: async () => {
            clearSfuReconnectTimer();
            const ok = await livekitClient.reconnectOrFail(10_000);
            if (!ok) {
              get().upsertToast("LiveKit reconnect failed", "danger");
              await get().endCurrentCall();
            }
          },
        });
        set({ sfuConnectedCallId: callId });
      },

      declineIncomingCall: async () => {
        const incoming = get().incoming;
        if (!incoming) return;
        set({ incoming: null });
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit("call:decline", { callId: incoming.callId });
          return;
        }
        await api.post(`/calls/${incoming.callId}/decline`).catch(() => undefined);
      },

      endCurrentCall: async () => {
        const active = get().activeCall;
        if (!active) return;
        const callId = active.callId;
        const socket = getSocket();
        if (active.isGroup && active.type === "VIDEO") {
          const ended = await api.post(`/calls/${callId}/sfu/end`).catch(() => null);
          if (!ended) {
            await api.post(`/calls/${callId}/sfu/leave`).catch(() => undefined);
          }
        } else if (socket?.connected) {
          socket.emit("call:end", { callId });
        } else {
          await api.post(`/calls/${callId}/end`).catch(() => undefined);
        }
        await get().resetCallState();
      },

      toggleMic: () => {
        const next = !get().isMicEnabled;
        if (get().activeCall?.isGroup && get().activeCall?.type === "VIDEO") {
          void livekitClient.setMicEnabled(next);
        } else {
          webrtcManager.toggleMic(next);
        }
        set({ isMicEnabled: next });
      },

      toggleCamera: async () => {
        const next = !get().isCameraEnabled;
        if (get().activeCall?.isGroup && get().activeCall?.type === "VIDEO") {
          await livekitClient.setCameraEnabled(next);
        } else {
          webrtcManager.toggleCamera(next);
        }
        set({ isCameraEnabled: next });
      },

      toggleSpeaker: () => {
        set({ isSpeakerEnabled: !get().isSpeakerEnabled });
      },

      switchCamera: async () => {
        await webrtcManager.switchCamera().catch(() => undefined);
      },

      refreshDevices: async () => {
        try {
          const devices = await enumerateCallDevices();
          set({ devices });
        } catch {
          get().upsertToast("Unable to enumerate media devices", "danger");
        }
      },

      setDevice: async (kind, deviceId) => {
        const current = get().devices;
        const next: CallDevices = { ...current };
        if (kind === "camera") {
          next.selectedCameraId = deviceId;
          window.localStorage.setItem("call:cameraId", deviceId);
        }
        if (kind === "microphone") {
          next.selectedMicrophoneId = deviceId;
          window.localStorage.setItem("call:microphoneId", deviceId);
          await webrtcManager.replaceAudioTrack({
            deviceId: deviceId ? { exact: deviceId } : undefined,
            noiseSuppression: next.noiseSuppressionEnabled,
            echoCancellation: true,
          });
        }
        if (kind === "speaker") {
          next.selectedSpeakerId = deviceId;
          window.localStorage.setItem("call:speakerId", deviceId);
        }
        set({ devices: next });
      },

      setAutoStartVideo: (enabled) => {
        set((state) => ({
          devices: { ...state.devices, autoStartVideo: enabled },
        }));
        window.localStorage.setItem("call:autoVideo", enabled ? "1" : "0");
      },

      setNoiseSuppression: async (enabled) => {
        set((state) => ({
          devices: { ...state.devices, noiseSuppressionEnabled: enabled },
        }));
        window.localStorage.setItem("call:noiseSuppression", enabled ? "1" : "0");
        const selectedMicrophoneId = get().devices.selectedMicrophoneId;
        await webrtcManager.replaceAudioTrack({
          deviceId: selectedMicrophoneId ? { exact: selectedMicrophoneId } : undefined,
          noiseSuppression: enabled,
          echoCancellation: true,
        });
      },

      startMicTest: async () => {
        get().stopMicTest();
        try {
          micAnalyzerStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: get().devices.selectedMicrophoneId
                ? { exact: get().devices.selectedMicrophoneId }
                : undefined,
            },
            video: false,
          });
          micAnalyzerCtx = new AudioContext();
          const src = micAnalyzerCtx.createMediaStreamSource(micAnalyzerStream);
          const analyser = micAnalyzerCtx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteFrequencyData(data);
            const average = data.reduce((sum, value) => sum + value, 0) / data.length;
            set({ micLevel: Math.min(100, Math.round((average / 255) * 100)) });
            micAnalyzerRaf = window.requestAnimationFrame(tick);
          };
          tick();
        } catch {
          get().upsertToast("Mic test unavailable", "danger");
        }
      },

      stopMicTest: () => {
        if (micAnalyzerRaf) {
          window.cancelAnimationFrame(micAnalyzerRaf);
          micAnalyzerRaf = null;
        }
        if (micAnalyzerCtx) {
          void micAnalyzerCtx.close();
          micAnalyzerCtx = null;
        }
        micAnalyzerStream?.getTracks().forEach((track) => track.stop());
        micAnalyzerStream = null;
        set({ micLevel: 0 });
      },

      resetCallState: async () => {
        clearSfuReconnectTimer();
        await livekitClient.disconnect().catch(() => undefined);
        await webrtcManager.close();
        get().stopMicTest();
        set({
          activeCall: null,
          incoming: null,
          localStream: null,
          remoteStreams: {},
          isMicEnabled: true,
          isCameraEnabled: true,
          sfuConnectedCallId: null,
        });
      },
    }),
    "callStore"
  )
);
