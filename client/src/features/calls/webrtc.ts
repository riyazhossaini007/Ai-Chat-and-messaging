type SignalEventName = "webrtc:offer" | "webrtc:answer" | "webrtc:ice" | "webrtc:renegotiate";

type SignalSender = (
  event: SignalEventName,
  payload: {
    callId: string;
    toUserId: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    meta?: Record<string, unknown>;
  }
) => void;

type RemoteStreamHandler = (userId: string, stream: MediaStream) => void;
type PeerStateHandler = (userId: string, state: RTCPeerConnectionState) => void;

const buildIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const turnUrl = (import.meta.env.VITE_TURN_URL ?? "").trim();
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: (import.meta.env.VITE_TURN_USERNAME ?? "").trim(),
      credential: (import.meta.env.VITE_TURN_PASSWORD ?? "").trim(),
    });
  }
  return servers;
};

class WebRtcManager {
  private callId: string | null = null;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private signalSender: SignalSender | null = null;
  private onRemoteStream: RemoteStreamHandler | null = null;
  private onPeerState: PeerStateHandler | null = null;

  setSignalSender(sender: SignalSender) {
    this.signalSender = sender;
  }

  setRemoteStreamHandler(handler: RemoteStreamHandler) {
    this.onRemoteStream = handler;
  }

  setPeerStateHandler(handler: PeerStateHandler) {
    this.onPeerState = handler;
  }

  getLocalStream() {
    return this.localStream;
  }

  async initSession(input: { callId: string; localUserId: string }) {
    this.callId = input.callId;
    void input.localUserId;
  }

  async ensureLocalStream(constraints: MediaStreamConstraints) {
    if (this.localStream) return this.localStream;
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }

  private createPeerConnection(remoteUserId: string) {
    const existing = this.peers.get(remoteUserId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: buildIceServers(),
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || !this.signalSender || !this.callId) return;
      this.signalSender("webrtc:ice", {
        callId: this.callId,
        toUserId: remoteUserId,
        candidate: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && this.onRemoteStream) {
        this.onRemoteStream(remoteUserId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (!this.onPeerState) return;
      this.onPeerState(remoteUserId, pc.connectionState);
    };

    this.peers.set(remoteUserId, pc);
    return pc;
  }

  async createOffer(remoteUserId: string, renegotiate = false) {
    if (!this.callId || !this.signalSender) return;
    const pc = this.createPeerConnection(remoteUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signalSender(renegotiate ? "webrtc:renegotiate" : "webrtc:offer", {
      callId: this.callId,
      toUserId: remoteUserId,
      sdp: offer,
    });
  }

  async handleOffer(payload: {
    fromUserId: string;
    sdp?: RTCSessionDescriptionInit;
    callId: string;
  }) {
    if (!payload.sdp || !this.signalSender) return;
    if (this.callId && payload.callId !== this.callId) return;
    this.callId = payload.callId;

    const pc = this.createPeerConnection(payload.fromUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.signalSender("webrtc:answer", {
      callId: payload.callId,
      toUserId: payload.fromUserId,
      sdp: answer,
    });
  }

  async handleAnswer(payload: { fromUserId: string; sdp?: RTCSessionDescriptionInit }) {
    if (!payload.sdp) return;
    const pc = this.peers.get(payload.fromUserId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
  }

  async handleIce(payload: { fromUserId: string; candidate?: RTCIceCandidateInit }) {
    if (!payload.candidate) return;
    const pc = this.peers.get(payload.fromUserId) ?? this.createPeerConnection(payload.fromUserId);
    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
  }

  toggleMic(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  toggleCamera(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  async switchCamera() {
    if (!this.localStream) return;
    const currentVideoTrack = this.localStream.getVideoTracks()[0];
    if (!currentVideoTrack) return;

    const facingMode =
      currentVideoTrack.getSettings().facingMode === "environment" ? "user" : "environment";
    const replacement = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false,
    });
    const nextTrack = replacement.getVideoTracks()[0];
    if (!nextTrack) return;

    this.localStream.removeTrack(currentVideoTrack);
    currentVideoTrack.stop();
    this.localStream.addTrack(nextTrack);

    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((item) => item.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(nextTrack);
      }
    }
  }

  async replaceAudioTrack(constraints: MediaTrackConstraints) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints,
      video: false,
    });
    const nextTrack = stream.getAudioTracks()[0];
    if (!nextTrack) return;

    const prevTrack = this.localStream?.getAudioTracks()[0];
    if (this.localStream && prevTrack) {
      this.localStream.removeTrack(prevTrack);
      prevTrack.stop();
      this.localStream.addTrack(nextTrack);
    }

    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((item) => item.track?.kind === "audio");
      if (sender) {
        await sender.replaceTrack(nextTrack);
      }
    }
  }

  async setOutputDevice(element: HTMLMediaElement, deviceId: string) {
    const withSinkId = element as HTMLMediaElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (!withSinkId.setSinkId) return;
    await withSinkId.setSinkId(deviceId);
  }

  async close() {
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.callId = null;
  }
}

export const webrtcManager = new WebRtcManager();
