export type Identity = {
  name: string;
  clientId: string;
  id: string; // alias
};

const KEY = "study-voice-identity-v1";

function rand(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randomName(): string {
  const animals = ["Lynx", "Fox", "Owl", "Bear", "Wolf", "Panda", "Otter", "Hawk"];
  const adj = ["Calm", "Bright", "Swift", "Kind", "Cool", "Brave", "Smart", "Gentle"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const b = animals[Math.floor(Math.random() * animals.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return `${a}${b}${n}`;
}

export function loadIdentity(): Identity {
  if (typeof window === "undefined") {
    // SSR中は適当な値を返す（画面表示で使う場合はクライアント側で置き換わる）
    const clientId = rand(16);
    const name = "server";
    return { name, clientId, id: clientId };
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Identity>;
      const clientId = typeof parsed.clientId === "string" && parsed.clientId ? parsed.clientId : rand(16);
      const name = typeof parsed.name === "string" && parsed.name ? parsed.name : randomName();
      const id = typeof (parsed as any).id === "string" && (parsed as any).id ? (parsed as any).id : clientId;
      const fixed: Identity = { name, clientId, id };
      localStorage.setItem(KEY, JSON.stringify(fixed));
      return fixed;
    }
  } catch {
    // fallthrough
  }

  const clientId = rand(16);
  const name = randomName();
  const obj: Identity = { name, clientId, id: clientId };
  localStorage.setItem(KEY, JSON.stringify(obj));
  return obj;
}
