"use client";

type Peer = {
  pc: RTCPeerConnection;
  remote: MediaStream;
  dc?: RTCDataChannel;
  audioTx?: RTCRtpTransceiver;
  videoTx?: RTCRtpTransceiver;
};

const RTC_CFG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

export class MeshCall {
  me: string;
  local: MediaStream;
  peers = new Map<string, Peer>();

  send: (to: string, payload: any) => void;
  onRemote: (peerId: string, stream: MediaStream) => void;
  onChat: (peerId: string, text: string) => void;

  constructor(opts: {
    me: string;
    local: MediaStream;
    send: (to: string, payload: any) => void;
    onRemote: (peerId: string, stream: MediaStream) => void;
    onChat: (peerId: string, text: string) => void;
  }) {
    this.me = opts.me;
    this.local = opts.local;
    this.send = opts.send;
    this.onRemote = opts.onRemote;
    this.onChat = opts.onChat;
  }

  private wireDC(peerId: string, dc: RTCDataChannel) {
    dc.onmessage = (ev) => this.onChat(peerId, String(ev.data ?? ""));
  }

  private ensureMediaTransceivers(p: Peer) {
    // Always keep exactly one audio and one video transceiver.
    if (!p.audioTx) {
      try {
        p.audioTx = p.pc.addTransceiver("audio", { direction: "sendrecv" });
      } catch {}
    }
    if (!p.videoTx) {
      try {
        p.videoTx = p.pc.addTransceiver("video", { direction: "sendrecv" });
      } catch {}
    }
  }

  private createPeer(peerId: string) {
    const pc = new RTCPeerConnection(RTC_CFG);
    const remote = new MediaStream();

    const peer: Peer = { pc, remote };
    this.peers.set(peerId, peer);

    // Create transceivers immediately (important for later replaceTrack)
    this.ensureMediaTransceivers(peer);

    // Attach current local tracks (even if sender.track is null)
    const a = this.local.getAudioTracks()[0] ?? null;
    const v = this.local.getVideoTracks()[0] ?? null;
    try { peer.audioTx?.sender.replaceTrack(a); } catch {}
    try { peer.videoTx?.sender.replaceTrack(v); } catch {}

    pc.ontrack = (ev) => {
      // Reliable across renegotiations: use ev.track
      const t = ev.track;
      if (!remote.getTracks().some((x) => x.id === t.id)) remote.addTrack(t);
      this.onRemote(peerId, remote);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.send(peerId, { kind: "ice", candidate: ev.candidate.toJSON() });
    };

    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      const p2 = this.peers.get(peerId);
      if (p2) {
        p2.dc = dc;
        this.wireDC(peerId, dc);
      }
    };

    return peer;
  }

  private async syncSenders(peerId: string) {
    const p = this.peers.get(peerId);
    if (!p) return;
    this.ensureMediaTransceivers(p);

    const a = this.local.getAudioTracks()[0] ?? null;
    const v = this.local.getVideoTracks()[0] ?? null;

    try { await p.audioTx?.sender.replaceTrack(a); } catch {}
    try { await p.videoTx?.sender.replaceTrack(v); } catch {}
  }

  private async renegotiate(peerId: string) {
    // Deterministic offerer to avoid glare:
    // smaller id creates offers; larger id asks smaller to offer.
    if (this.me < peerId) {
      await this.makeOffer(peerId);
    } else {
      this.send(peerId, { kind: "need_offer" });
    }
  }

  async ensurePeer(peerId: string) {
    if (peerId === this.me) return;
    if (!this.peers.has(peerId)) this.createPeer(peerId);

    if (this.me < peerId) {
      const p = this.peers.get(peerId)!;
      if (!p.dc) {
        p.dc = p.pc.createDataChannel("chat");
        this.wireDC(peerId, p.dc);
      }
      await this.makeOffer(peerId);
    }
  }

  async makeOffer(peerId: string) {
    const p = this.peers.get(peerId) ?? this.createPeer(peerId);
    this.ensureMediaTransceivers(p);

    const offer = await p.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await p.pc.setLocalDescription(offer);
    this.send(peerId, { kind: "offer", sdp: offer });
  }

  async onSignal(from: string, payload: any) {
    if (from === this.me) return;
    const kind = payload?.kind;
    const p = this.peers.get(from) ?? this.createPeer(from);
    this.ensureMediaTransceivers(p);

    if (kind === "need_offer") {
      await this.makeOffer(from);
      return;
    }

    if (kind === "offer") {
      await p.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await p.pc.createAnswer();
      await p.pc.setLocalDescription(answer);
      this.send(from, { kind: "answer", sdp: answer });
      return;
    }

    if (kind === "answer") {
      if (!p.pc.currentRemoteDescription) await p.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      return;
    }

    if (kind === "ice" && payload.candidate) {
      try { await p.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
      return;
    }
  }

  async refreshTracksAndRenegotiate() {
    for (const peerId of this.peers.keys()) {
      await this.syncSenders(peerId);
      await this.renegotiate(peerId);
    }
  }

  sendChat(text: string) {
    for (const [id, p] of this.peers) {
      if (id === this.me) continue;
      const dc = p.dc;
      if (dc && dc.readyState === "open") {
        try { dc.send(text); } catch {}
      }
    }
  }

  removePeer(peerId: string) {
    const p = this.peers.get(peerId);
    if (!p) return;
    try { p.dc?.close(); } catch {}
    try { p.pc.close(); } catch {}
    this.peers.delete(peerId);
  }

  closeAll() {
    for (const id of Array.from(this.peers.keys())) this.removePeer(id);
  }
}
