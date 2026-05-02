type RoomLike = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void> | void;
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
  localParticipant: {
    setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
    setCameraEnabled: (enabled: boolean) => Promise<void>;
  };
  remoteParticipants: Map<string, any>;
  state?: string;
};

const LIVEKIT_CLIENT_MODULE = "livekit-client";

class LiveKitClient {
  private room: RoomLike | null = null;
  private module: any = null;
  private reconnectStartedAt: number | null = null;

  private async loadModule() {
    if (this.module) return this.module;
    const moduleName: string = LIVEKIT_CLIENT_MODULE;
    this.module = (await import(moduleName)) as any;
    return this.module;
  }

  async connect(input: {
    livekitUrl: string;
    token: string;
    onParticipantConnected?: (identity: string, track?: MediaStreamTrack) => void;
    onParticipantDisconnected?: (identity: string) => void;
    onDisconnected?: () => void;
    onSignalReconnecting?: () => void;
    onSignalReconnected?: () => void;
  }) {
    const sdk = await this.loadModule();
    const room = new sdk.Room({
      adaptiveStream: true,
      dynacast: true,
    });
    this.room = room;

    room.on("participantConnected", (participant: any) => {
      input.onParticipantConnected?.(participant.identity);
      participant.on("trackSubscribed", (track: any) => {
        const mediaTrack = track?.mediaStreamTrack as MediaStreamTrack | undefined;
        if (mediaTrack) {
          input.onParticipantConnected?.(participant.identity, mediaTrack);
        }
      });
    });
    room.on("participantDisconnected", (participant: any) => {
      input.onParticipantDisconnected?.(participant.identity);
    });

    const signalReconnectingEvent = sdk.RoomEvent?.SignalReconnecting ?? "signalReconnecting";
    const signalReconnectedEvent = sdk.RoomEvent?.Reconnected ?? "reconnected";
    room.on(signalReconnectingEvent, () => {
      this.reconnectStartedAt = Date.now();
      input.onSignalReconnecting?.();
    });
    room.on(signalReconnectedEvent, () => {
      this.reconnectStartedAt = null;
      input.onSignalReconnected?.();
    });
    room.on("disconnected", () => {
      input.onDisconnected?.();
    });

    await room.connect(input.livekitUrl, input.token);
  }

  async setMicEnabled(enabled: boolean) {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  async setCameraEnabled(enabled: boolean) {
    if (!this.room) return;
    await this.room.localParticipant.setCameraEnabled(enabled);
  }

  async reconnectOrFail(maxMs = 10_000) {
    if (!this.room) return false;
    if (!this.reconnectStartedAt) return true;
    const elapsed = Date.now() - this.reconnectStartedAt;
    return elapsed <= maxMs;
  }

  getRemoteParticipantIds() {
    if (!this.room) return [];
    return Array.from(this.room.remoteParticipants.keys());
  }

  async disconnect() {
    await this.room?.disconnect();
    this.room = null;
    this.reconnectStartedAt = null;
  }
}

export const livekitClient = new LiveKitClient();
