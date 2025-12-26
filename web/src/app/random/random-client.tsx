"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadIdentity } from "@/lib/identity";
import { wsRandomUrl } from "@/lib/signaling";

export default function RandomClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const identity = useMemo(() => loadIdentity(), []);
  const [status, setStatus] = useState("待機中…");

  const topic = sp.get("topic") ?? "study";
  const max = sp.get("max") ?? "4";

  useEffect(() => {
    setStatus("マッチング中…");

    const url = wsRandomUrl({
      topic,
      max: Number(max),
      clientId: identity.clientId,
      name: identity.name,
    });

    const ws = new WebSocket(url);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg?.type === "match" && msg.roomId) {
          router.replace(`/room/${msg.roomId}?max=${encodeURIComponent(max)}`);
        }
      } catch {}
    };

    ws.onopen = () => setStatus("待機中（相手を探しています）…");
    ws.onerror = () => setStatus("接続エラー（Signal URL を確認してください）");
    ws.onclose = () => {};

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [router, topic, max, identity.clientId, identity.name]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>ランダム通話</h2>
      <p style={{ marginTop: 8 }}>{status}</p>
      <p style={{ marginTop: 8, opacity: 0.7 }}>
        topic: {topic} / max: {max}
      </p>
    </div>
  );
}
