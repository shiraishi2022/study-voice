"use client";
const genId = () => {
  // modern browsers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // fallback
  return "id-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
};
export type Identity = {
  name: string;
  id: string;        // ← 追加
  clientId: string;  // ← 既にあるなら維持
};


function randomName() {
  const a = ["Study", "Focus", "Math", "Eng", "Sci", "Code", "Zen", "Note", "Geo", "AI"];
  const b = ["Cat", "Fox", "Owl", "Bear", "Panda", "Wolf", "Koala", "Crow", "Tiger", "Lynx"];
  return `${a[Math.floor(Math.random()*a.length)]}${b[Math.floor(Math.random()*b.length)]}${Math.floor(Math.random()*900+100)}`;
}

export function loadIdentity(): Identity {
  const key = "study_identity_v3";
  const raw = localStorage.getItem(key);
  if (raw) return JSON.parse(raw) as Identity;
  const obj = { id: genId(), name: randomName() };
  localStorage.setItem(key, JSON.stringify(obj));
  return obj;
}
