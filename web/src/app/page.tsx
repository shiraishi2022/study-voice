"use client";
const genId = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "id-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
};

import { Btn, Card, Input } from "@/components/UI";
import { loadIdentity, type Identity } from "@/lib/identity";
import { httpBase } from "@/lib/signaling";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RoomItem = { roomId: string; kind: "room"|"dm"|"rand"; lastActive: number; count?: number };

function makeRoomCode(prefix: string) {
  return `${prefix}-${genId().slice(0, 8)}`;
}

export default function HomePage() {
  const router = useRouter();

  // hydration-safe: render placeholder until mounted
  const [me, setMe] = useState<Identity | null>(null);
  useEffect(() => { setMe(loadIdentity()); }, []);

  const [topic, setTopic] = useState("study");
  const [roomCode, setRoomCode] = useState("");
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [roomsErr, setRoomsErr] = useState<string | null>(null);

  const refreshRooms = async () => {
    setRoomsErr(null);
    try {
      const res = await fetch(`${httpBase()}/api/rooms?limit=30`, { cache: "no-store" });
      if (!res.ok) throw new Error(`rooms fetch failed: ${res.status}`);
      const data = await res.json();
      setRooms(data.rooms ?? []);
    } catch (e: any) {
      setRoomsErr(String(e?.message ?? e));
    }
  };

  useEffect(() => { refreshRooms(); }, []);

  const myName = me?.name ?? "…";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,0.9)", display: "grid", placeItems: "center", fontWeight: 900 }}>S</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Study</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>あなた: <b suppressHydrationWarning>{myName}</b></div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18 }}>
        <Card>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>🎲 ランダム通話（最大4人）</div>
          <div style={{ display: "grid", gap: 10 }}>
            <Input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="topic（例: english, math）" />
            <Btn onClick={()=> router.push(`/random?topic=${encodeURIComponent(topic)}&max=4`)} disabled={!me}>参加する</Btn>
          </div>
          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
            同じtopicの人とマッチします。人数が揃うと自動で部屋に移動します。
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>🔒 プライベートルーム</div>
          <div style={{ display: "grid", gap: 10 }}>
            <Btn onClick={()=> router.push(`/room/${makeRoomCode("room")}`)} disabled={!me}>新規ルームを作る</Btn>
            <Input value={roomCode} onChange={(e)=>setRoomCode(e.target.value)} placeholder="既存ルームコード（例: room-1a2b3c4d）" />
            <Btn variant="ghost" onClick={()=> router.push(`/room/${roomCode.trim()}`)} disabled={!me || !roomCode.trim()}>コードで入る</Btn>
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>☎️ 1:1（個人通話）</div>
          <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 10 }}>
            1:1用URLを作って相手に送ってください。
          </div>
          <Btn onClick={()=> router.push(`/room/${makeRoomCode("dm")}?max=2`)} disabled={!me}>1:1 URLを作る</Btn>
        </Card>

        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ fontWeight: 900 }}>🗂 部屋一覧</div>
            <Btn variant="ghost" onClick={refreshRooms}>更新</Btn>
          </div>
          {roomsErr ? <div style={{ marginTop: 10, color:"#ffb4b4", fontWeight: 800 }}>{roomsErr}</div> : null}
          <div style={{ marginTop: 12, display:"grid", gap:10 }}>
            {rooms.length === 0 ? (
              <div style={{ opacity: 0.7, fontSize: 13 }}>まだ部屋がありません。ルームを作るとここに出ます。</div>
            ) : rooms.map(r => (
              <div key={r.roomId} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap",
                padding: 12, borderRadius: 14, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)"
              }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{r.roomId}</div>
                  <div style={{ opacity:0.75, fontSize: 12 }}>
                    種類: {r.kind} / 最終: {new Date(r.lastActive).toLocaleString()}
                  </div>
                </div>
                <Btn onClick={()=> router.push(`/room/${r.roomId}`)} disabled={!me}>入る</Btn>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
