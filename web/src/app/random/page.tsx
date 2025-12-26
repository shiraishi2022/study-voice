"use client";

import { Btn, Card } from "@/components/UI";
import { loadIdentity, type Identity } from "@/lib/identity";
import { connectRandom, SignalMessage } from "@/lib/signaling";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function RandomPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const topic = sp.get("topic") ?? "study";
  const max = Number(sp.get("max") ?? "4");

  const [me, setMe] = useState<Identity | null>(null);
  const [status, setStatus] = useState("準備中…");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => { setMe(loadIdentity()); }, []);

  useEffect(() => {
    if (!me) return;
    setStatus("マッチ待機中…");
    try {
      const ws = connectRandom({
        topic, max,
        clientId: me.id, name: me.name,
        onMessage: (m: SignalMessage) => {
          if (m.type === "match") {
            setStatus("マッチしました！部屋へ移動します…");
            ws.close();
            router.push(`/room/${m.roomId}?max=${max}`);
          } else if (m.type === "error") {
            setStatus(`エラー: ${m.message}`);
          } else {
            setStatus("マッチ待機中…");
          }
        },
      });
      wsRef.current = ws;
      return () => { try { ws.close(); } catch {} };
    } catch (e: any) {
      setStatus(String(e?.message ?? e));
    }
  }, [topic, max, me, router]);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: 20 }}>
      <Card>
        <div style={{ fontWeight: 900, fontSize: 18 }}>🎲 ランダム通話</div>
        <div style={{ marginTop: 10, opacity: 0.85 }}>topic: <b>{topic}</b> / 最大: <b>{max}</b>人</div>
        <div style={{ marginTop: 10, opacity: 0.9 }}>{status}</div>
        <div style={{ marginTop: 14, display:"flex", gap:10 }}>
          <Btn variant="ghost" onClick={()=> { wsRef.current?.close(); router.push("/"); }}>戻る</Btn>
        </div>
      </Card>
    </div>
  );
}
