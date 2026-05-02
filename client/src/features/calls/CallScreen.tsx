import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "./callStore";
import { webrtcManager } from "./webrtc";

const useDuration = (startedAt: string | null) => {
  const started = startedAt ? new Date(startedAt).getTime() : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [started]);
  if (!started) return "00:00";
  const diff = Math.max(0, Math.floor((now - started) / 1000));
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export function CallScreen() {
  const navigate = useNavigate();
  const activeCall = useCallStore((state) => state.activeCall);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStreams = useCallStore((state) => state.remoteStreams);
  const isMicEnabled = useCallStore((state) => state.isMicEnabled);
  const isCameraEnabled = useCallStore((state) => state.isCameraEnabled);
  const isSpeakerEnabled = useCallStore((state) => state.isSpeakerEnabled);
  const toggleMic = useCallStore((state) => state.toggleMic);
  const toggleCamera = useCallStore((state) => state.toggleCamera);
  const toggleSpeaker = useCallStore((state) => state.toggleSpeaker);
  const switchCamera = useCallStore((state) => state.switchCamera);
  const endCurrentCall = useCallStore((state) => state.endCurrentCall);
  const devices = useCallStore((state) => state.devices);
  const toasts = useCallStore((state) => state.toasts);
  const dismissToast = useCallStore((state) => state.dismissToast);
  const showUpgradeModal = useCallStore((state) => state.showUpgradeModal);
  const closeUpgradeModal = useCallStore((state) => state.closeUpgradeModal);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const duration = useDuration(activeCall?.startedAt ?? null);

  const remoteEntries = useMemo(() => Object.entries(remoteStreams), [remoteStreams]);

  useEffect(() => {
    if (!activeCall) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeCall]);

  useEffect(() => {
    if (!localVideoRef.current || !localStream) return;
    localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    remoteEntries.forEach(([userId, stream]) => {
      const node = remoteVideoRefs.current[userId];
      if (!node) return;
      node.srcObject = stream;
      if (devices.selectedSpeakerId) {
        void webrtcManager.setOutputDevice(node, devices.selectedSpeakerId);
      }
    });
  }, [devices.selectedSpeakerId, remoteEntries]);

  if (!activeCall && toasts.length === 0 && !showUpgradeModal) return null;

  return (
    <>
      {activeCall && (
        <div className="fixed inset-0 z-[150] flex flex-col bg-[radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.12),transparent_45%),radial-gradient(circle_at_20%_88%,rgba(16,185,129,0.12),transparent_45%),#020617] p-4 text-white">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 backdrop-blur">
            <div>
              <div className="text-sm text-zinc-300">
                {activeCall.type === "VIDEO" ? "Video call" : "Voice call"} • {activeCall.state}
              </div>
              <div className="text-lg font-semibold">{duration}</div>
            </div>
            <div className="text-xs text-zinc-400">Participants: {activeCall.participants.length}</div>
          </div>

          <div className="mt-4 grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
              {activeCall.type === "VIDEO" ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">Audio only</div>
              )}
              <div className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-1 text-xs">You</div>
            </div>

            {remoteEntries.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 text-sm text-zinc-400">
                Waiting for participants...
              </div>
            ) : (
              remoteEntries.map(([userId]) => (
                <div key={userId} className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
                  {activeCall.type === "VIDEO" ? (
                    <video
                      ref={(node) => {
                        remoteVideoRefs.current[userId] = node;
                      }}
                      autoPlay
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-300">
                      Remote audio: {userId}
                    </div>
                  )}
                  <div className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-1 text-xs">{userId}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/65 p-3 backdrop-blur">
            <button
              type="button"
              onClick={toggleMic}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />} Mic
            </button>
            <button
              type="button"
              onClick={() => {
                void toggleCamera();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              {isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />} Camera
            </button>
            <button
              type="button"
              onClick={() => {
                void switchCamera();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              <RotateCcw size={16} /> Switch
            </button>
            <button
              type="button"
              onClick={toggleSpeaker}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              {isSpeakerEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />} Speaker
            </button>
            <button
              type="button"
              onClick={() => {
                void endCurrentCall();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/20 px-4 py-2 text-sm text-rose-100 hover:bg-rose-500/30"
            >
              <PhoneOff size={16} /> End
            </button>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-[170] space-y-2">
          {toasts.map((toast) => (
            <button
              key={toast.id}
              type="button"
              onClick={() => dismissToast(toast.id)}
              className={`rounded-xl border px-3 py-2 text-left text-sm shadow-xl ${
                toast.tone === "danger"
                  ? "border-rose-500/40 bg-rose-950/75 text-rose-100"
                  : "border-cyan-500/35 bg-zinc-900/85 text-zinc-100"
              }`}
            >
              {toast.message}
            </button>
          ))}
        </div>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 z-[175] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/95 p-5 text-white">
            <h3 className="text-lg font-semibold">Upgrade Required</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Calling is available for paid plans only.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  closeUpgradeModal();
                  navigate("/credits");
                }}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white hover:bg-cyan-500"
              >
                Upgrade plan
              </button>
              <button
                type="button"
                onClick={closeUpgradeModal}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
