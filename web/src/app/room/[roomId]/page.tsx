"use client";

import { Btn, Card, Input, ToggleIconButton } from "@/components/UI";
import { loadIdentity, type Identity } from "@/lib/identity";
import { connectRoom, SignalMessage } from "@/lib/signaling";
import { MeshCall } from "@/lib/webrtc_mesh";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type Member = { clientId: string; name: string };
type ChatMsg = { at: number; from: string; text: string; me?: boolean };

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const sp = useSearchParams();
  const roomId = params.roomId;
  const max = Number(sp.get("max") ?? "4");

  const [me, setMe] = useState<Identity | null>(null);
  useEffect(() => { setMe(loadIdentity()); }, []);
  const [shareUrl, setShareUrl] = useState<string>("");
  useEffect(() => { if (typeof window !== "undefined") setShareUrl(window.location.href); }, [roomId]);
  const myName = me?.name ?? "…";
  const myId = me?.clientId ?? me?.id ?? "";

  const [members, setMembers] = useState<Member[]>([]);
  const [inCall, setInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const callRef = useRef<MeshCall | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const [remote, setRemote] = useState<{ id: string; stream: MediaStream }[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!me) return;
    try {
      const ws = connectRoom({
        roomId,
        clientId: me.id,
        name: me.name,
        onMessage: async (m: SignalMessage) => {
          if (m.type === "joined") {
            setMembers(m.members);
            if (callRef.current) for (const mem of m.members) await callRef.current.ensurePeer(mem.clientId);
          } else if (m.type === "member_joined") {
            setMembers(prev => prev.some(x => x.clientId === m.clientId) ? prev : [...prev, { clientId: m.clientId, name: m.name }]);
            if (callRef.current) await callRef.current.ensurePeer(m.clientId);
          } else if (m.type === "member_left") {
            setMembers(prev => prev.filter(x => x.clientId !== m.clientId));
            callRef.current?.removePeer(m.clientId);
            setRemote(prev => prev.filter(x => x.id !== m.clientId));
          } else if (m.type === "signal") {
            await callRef.current?.onSignal(m.from, m.payload);
          } else if (m.type === "error") {
            setErr(m.message);
          }
        },
      });
      wsRef.current = ws;
      return () => { try { ws.close(); } catch {} };
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }, [roomId, me]);

  const startCall = async (wantVideo: boolean) => {
    setErr(null);
    if (inCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(()=>{});
      }

      const send = (to: string, payload: any) => wsRef.current?.send(JSON.stringify({ type: "signal", to, payload }));

      const call = new MeshCall({
        me: myId,
        local: stream,
        send,
        onRemote: (peerId, s) => {
          setRemote(prev => {
            const next = prev.filter(x => x.id !== peerId);
            next.push({ id: peerId, stream: s });
            return next;
          });
        },
        onChat: (_peerId, text) => setChat(prev => [...prev, { at: Date.now(), from: "peer", text }])
      });
      callRef.current = call;

      for (const m of members) await call.ensurePeer(m.clientId);

      setInCall(true);
      setMicOn(true);
      setCamOn(wantVideo);
      setScreenOn(false);
      setChat(prev => [...prev, { at: Date.now(), from: "system", text: "通話を開始しました" }]);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };

  const stopCall = async () => {
    callRef.current?.closeAll();
    callRef.current = null;
    setRemote([]);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setInCall(false);
    setChat(prev => [...prev, { at: Date.now(), from: "system", text: "通話を終了しました" }]);
  };

  const toggleMic = () => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !micOn;
    s.getAudioTracks().forEach(t => t.enabled = next);
    setMicOn(next);
  };

  
const toggleCam = async () => {
  const s = localStreamRef.current;
  if (!s) return;

  if (camOn) {
    // stop and remove existing camera/screen video track
    s.getVideoTracks().forEach(t => t.stop());
    s.getTracks().forEach(t => { if (t.kind === "video") s.removeTrack(t); });
    setCamOn(false);
    setScreenOn(false);
    await callRef.current?.refreshTracksAndRenegotiate();
    return;
  }

  try {
    const vs = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const vt = vs.getVideoTracks()[0];
    if (vt) {
      s.getTracks().forEach(t => { if (t.kind === "video") { try { t.stop(); } catch {} s.removeTrack(t);} });
      s.addTrack(vt);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = s;
        await localVideoRef.current.play().catch(()=>{});
      }
      setCamOn(true);
      setScreenOn(false);
      await callRef.current?.refreshTracksAndRenegotiate();
    }
  } catch (e: any) {
    setErr(String(e?.message ?? e));
  }
};

const startScreenShare = async () => {
    const s = localStreamRef.current;
    if (!s) return;

    if (screenOn) {
      // stop current screen/cam video track
      s.getVideoTracks().forEach(t => t.stop());
      s.getTracks().forEach(t => { if (t.kind === "video") s.removeTrack(t); });
      setScreenOn(false);
      setCamOn(false);
      await callRef.current?.refreshTracksAndRenegotiate();
      return;
    }

  try {
    // @ts-ignore
    const ds: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
    const dt = ds.getVideoTracks()[0];
    if (!dt) return;

    // replace current video track with display track
    s.getTracks().forEach(t => { if (t.kind === "video") { try { t.stop(); } catch {} s.removeTrack(t);} });
    s.addTrack(dt);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = s;
      await localVideoRef.current.play().catch(()=>{});
    }

    setCamOn(false);
    setScreenOn(true);
    await callRef.current?.refreshTracksAndRenegotiate();

    dt.onended = async () => {
      // when screen share ends, fall back to no video
      try {
        const ss = localStreamRef.current;
        if (!ss) return;
        ss.getTracks().forEach(t => { if (t.kind === "video") { try { t.stop(); } catch {} ss.removeTrack(t);} });
        setScreenOn(false);
        setCamOn(false);
        await callRef.current?.refreshTracksAndRenegotiate();
      } catch {}
    };
  } catch (e: any) {
    setErr(String(e?.message ?? e));
  }
};

  const sendChat = () => {
    if (!me) return;
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setChat(prev => [...prev, { at: Date.now(), from: me.name, text, me: true }]);
    callRef.current?.sendChat(`${me.name}: ${text}`);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Room: {roomId}</div>
          <div style={{ opacity: 0.8, fontSize: 13 }}>あなた: <b suppressHydrationWarning>{myName}</b> / 最大: {max}人</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <Btn variant="ghost" onClick={()=> { stopCall(); router.push("/"); }}>戻る</Btn>
        </div>
      </div>

      {err ? <div style={{ marginTop: 12, color: "#ffb4b4", fontWeight: 800 }}>{err}</div> : null}

      <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, marginTop:16 }}>
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ fontWeight: 900 }}>🎥 通話（音声/ビデオ）</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {!inCall ? <>
                <Btn onClick={()=>startCall(false)} disabled={!me}>音声で開始</Btn>
                <Btn variant="ghost" onClick={()=>startCall(true)} disabled={!me}>ビデオで開始</Btn>
              </> : <>
                <Btn onClick={stopCall}>終了</Btn>
                                <ToggleIconButton label="ミュート" kind="mic" state={micOn ? "on" : "off"} onClick={toggleMic} />
                <ToggleIconButton label="ビデオ" kind="video" state={camOn ? "on" : "off"} onClick={toggleCam} />
                <ToggleIconButton label="画面共有" kind="screen" state={screenOn ? "on" : "off"} onClick={startScreenShare} />
                <Btn variant="ghost" onClick={() => callRef.current?.refreshTracksAndRenegotiate()} style={{ height: 54 }}>相手に映像を更新</Btn>
              </>}
            </div>
          </div>

          <div style={{ marginTop: 14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <VideoTile title={`あなた（${myName}）`} muted refEl={localVideoRef} />
            {remote.map(r => <RemoteTile key={r.id} id={r.id} stream={r.stream} />)}
          </div>

          <div style={{ marginTop: 14, opacity: 0.75, fontSize: 12 }}>
            共有URL（友達に送る）: <span style={{ userSelect:"all" }} suppressHydrationWarning>{shareUrl}</span>
          </div>
        </Card>

        <div style={{ display:"grid", gap:16 }}>
          <Card>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>👥 参加者</div>
            <div style={{ display:"grid", gap:10 }}>
              {members.map(m => (
                <div key={m.clientId} style={{
                  display:"flex", justifyContent:"space-between", gap:10, alignItems:"center",
                  padding:10, borderRadius:14, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)"
                }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{m.name}</div>
                    <div style={{ opacity:0.7, fontSize:12 }}>{m.clientId.slice(0,6)}{m.clientId===myId ? " (you)" : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>💬 チャット</div>
            <div style={{
              height: 260, overflow:"auto", padding:10, borderRadius:14,
              background:"rgba(0,0,0,0.25)", border:"1px solid rgba(255,255,255,0.10)"
            }}>
              {chat.length === 0 ? <div style={{ opacity:0.7, fontSize:13 }}>まだメッセージがありません。</div> : chat.map((m, i) => (
                <div key={i} style={{ marginBottom: 8, opacity: 0.95 }}>
                  <span style={{ opacity:0.65, fontSize:12 }}>{new Date(m.at).toLocaleTimeString()}</span>{" "}
                  <b style={{ color: m.me ? "#c7d2fe" : "#fff" }}>{m.from === "system" ? "system" : (m.me ? myName : "peer")}</b>
                  : {m.text}
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, marginTop: 10 }}>
              <Input value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder="Enterで送信（通話中のみ）" onKeyDown={(e)=>{ if(e.key==="Enter"){ e.preventDefault(); if(inCall) sendChat(); } }} />
              <Btn onClick={()=> inCall && sendChat()} disabled={!inCall}>送信</Btn>
            </div>
            <div style={{ marginTop: 8, opacity:0.7, fontSize:12 }}>
              ※ チャットは通話中のメンバーへ送信（履歴は保存しません）
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function VideoTile({ title, muted, refEl }: { title: string; muted?: boolean; refEl: React.RefObject<HTMLVideoElement> }) {
  return (
    <div style={{ borderRadius: 16, overflow:"hidden", border:"1px solid rgba(255,255,255,0.12)", background:"rgba(0,0,0,0.35)" }}>
      <div style={{ padding:10, fontWeight: 900, fontSize: 13, opacity: 0.9 }}>{title}</div>
      <video ref={refEl} muted={muted} playsInline style={{ width:"100%", height: 220, objectFit:"cover", background:"#000" }} />
    </div>
  );
}

function RemoteTile({ id, stream }: { id: string; stream: MediaStream }) {
  const vref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!vref.current) return;
    vref.current.srcObject = stream;
    vref.current.play().catch(()=>{});
  }, [stream]);

  return (
    <div style={{ borderRadius: 16, overflow:"hidden", border:"1px solid rgba(255,255,255,0.12)", background:"rgba(0,0,0,0.35)" }}>
      <div style={{ padding:10, fontWeight: 900, fontSize: 13, opacity: 0.9 }}>peer: {id.slice(0,6)}</div>
      <video ref={vref} playsInline style={{ width:"100%", height: 220, objectFit:"cover", background:"#000" }} />
    </div>
  );
}
