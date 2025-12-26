"use client";
export type SignalMessage =
  | { type: "joined"; roomId: string; members: { clientId: string; name: string }[] }
  | { type: "member_joined"; clientId: string; name: string }
  | { type: "member_left"; clientId: string }
  | { type: "match"; roomId: string; members: { clientId: string; name: string }[] }
  | { type: "signal"; from: string; to: string; payload: any }
  | { type: "error"; message: string };

function wsBase() {
  const base = process.env.NEXT_PUBLIC_SIGNALING_BASE;
  if (!base) throw new Error("NEXT_PUBLIC_SIGNALING_BASE が未設定です（web/.env.local）");
  return base.replace(/^http/, "ws").replace(/\/$/, "");
}

export function httpBase() {
  const base = process.env.NEXT_PUBLIC_SIGNALING_BASE;
  if (!base) throw new Error("NEXT_PUBLIC_SIGNALING_BASE が未設定です（web/.env.local）");
  return base.replace(/\/$/, "");
}

export function connectRoom(params: { roomId: string; clientId: string; name: string; onMessage: (m: SignalMessage)=>void; onClose?: ()=>void; }) {
  const url = `${wsBase()}/ws/room/${encodeURIComponent(params.roomId)}?clientId=${encodeURIComponent(params.clientId)}&name=${encodeURIComponent(params.name)}`;
  const ws = new WebSocket(url);
  ws.onmessage = (ev) => { try { params.onMessage(JSON.parse(ev.data)); } catch {} };
  ws.onclose = () => params.onClose?.();
  return ws;
}

export function connectRandom(params: { topic: string; max: number; clientId: string; name: string; onMessage: (m: SignalMessage)=>void; onClose?: ()=>void; }) {
  const url = `${wsBase()}/ws/random?topic=${encodeURIComponent(params.topic)}&max=${params.max}&clientId=${encodeURIComponent(params.clientId)}&name=${encodeURIComponent(params.name)}`;
  const ws = new WebSocket(url);
  ws.onmessage = (ev) => { try { params.onMessage(JSON.parse(ev.data)); } catch {} };
  ws.onclose = () => params.onClose?.();
  return ws;
}
// web/src/lib/signaling.ts に追記

export function wsRandomUrl(params: {
  topic: string;
  max: number;
  clientId: string;
  name: string;
}): string {
  const base = wsBase();
  const u = new URL(base);
  u.pathname = "/ws/random";
  u.searchParams.set("topic", params.topic);
  u.searchParams.set("max", String(params.max));
  u.searchParams.set("clientId", params.clientId);
  u.searchParams.set("name", params.name);
  return u.toString();
}
