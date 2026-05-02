import { useEffect } from "react";
import { useCallStore } from "./callStore";

export function CallSettings() {
  const open = useCallStore((state) => state.isCallSettingsOpen);
  const close = useCallStore((state) => state.closeCallSettings);
  const devices = useCallStore((state) => state.devices);
  const refreshDevices = useCallStore((state) => state.refreshDevices);
  const setDevice = useCallStore((state) => state.setDevice);
  const setAutoStartVideo = useCallStore((state) => state.setAutoStartVideo);
  const setNoiseSuppression = useCallStore((state) => state.setNoiseSuppression);
  const micLevel = useCallStore((state) => state.micLevel);
  const startMicTest = useCallStore((state) => state.startMicTest);
  const stopMicTest = useCallStore((state) => state.stopMicTest);

  useEffect(() => {
    if (!open) return;
    void refreshDevices();
    return () => stopMicTest();
  }, [open, refreshDevices, stopMicTest]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[155] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Call Settings</h3>
          <button type="button" onClick={close} className="rounded-md px-2 py-1 text-xs hover:bg-white/10">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <label className="block">
            <div className="mb-1 text-zinc-300">Camera</div>
            <select
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
              value={devices.selectedCameraId}
              onChange={(event) => {
                void setDevice("camera", event.target.value);
              }}
            >
              {devices.cameras.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 4)}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-zinc-300">Microphone</div>
            <select
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
              value={devices.selectedMicrophoneId}
              onChange={(event) => {
                void setDevice("microphone", event.target.value);
              }}
            >
              {devices.microphones.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 4)}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-zinc-300">Speaker</div>
            <select
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
              value={devices.selectedSpeakerId}
              onChange={(event) => {
                void setDevice("speaker", event.target.value);
              }}
            >
              {devices.speakers.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Speaker ${device.deviceId.slice(0, 4)}`}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="mb-2 flex items-center justify-between text-zinc-300">
              <span>Mic level test</span>
              <div className="flex gap-2">
                <button className="rounded-md bg-cyan-600 px-2 py-1 text-xs" onClick={() => void startMicTest()}>
                  Start
                </button>
                <button className="rounded-md bg-zinc-700 px-2 py-1 text-xs" onClick={stopMicTest}>
                  Stop
                </button>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                style={{ width: `${micLevel}%` }}
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
            <span>Auto-start video for video calls</span>
            <input
              type="checkbox"
              checked={devices.autoStartVideo}
              onChange={(event) => setAutoStartVideo(event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
            <span>Noise suppression</span>
            <input
              type="checkbox"
              disabled={!devices.noiseSuppressionSupported}
              checked={devices.noiseSuppressionEnabled}
              onChange={(event) => {
                void setNoiseSuppression(event.target.checked);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
