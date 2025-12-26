export interface Env {
  ROOMS: DurableObjectNamespace;
  LOBBIES: DurableObjectNamespace;
  INDEX: DurableObjectNamespace;
}

function json(data: any, status = 200, extraHeaders: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}
function bad(msg: string, status = 400) { return json({ error: msg }, status); }

function cors(request: Request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
    if (url.pathname === "/health") return json({ ok: true }, 200, cors(request));

    // 部屋一覧（アクティブな部屋のみ返す）
    if (url.pathname === "/api/rooms") {
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "30")));
      const id = env.INDEX.idFromName("rooms-index");
      const stub = env.INDEX.get(id);
      const resp = await stub.fetch(new Request("https://index/list?limit="+limit));
      const data = await resp.json();
      return json(data, 200, cors(request));
    }

    // /ws/room/{roomId}?clientId=...&name=...
    if (url.pathname.startsWith("/ws/room/")) {
      if (request.headers.get("Upgrade") !== "websocket") return bad("expected websocket", 426);
      const roomId = decodeURIComponent(url.pathname.replace("/ws/room/", ""));
      const id = env.ROOMS.idFromName(roomId);
      return env.ROOMS.get(id).fetch(request);
    }

    // /ws/random?topic=...&max=4&clientId=...&name=...
    if (url.pathname === "/ws/random") {
      if (request.headers.get("Upgrade") !== "websocket") return bad("expected websocket", 426);
      const topic = url.searchParams.get("topic") ?? "study";
      const max = Math.max(2, Math.min(6, Number(url.searchParams.get("max") ?? "4")));
      const lobbyName = `topic:${topic}:max:${max}`;
      const id = env.LOBBIES.idFromName(lobbyName);
      return env.LOBBIES.get(id).fetch(request);
    }

    return bad("not found", 404);
  }
};

type ClientInfo = { clientId: string; name: string; ws: WebSocket };

// --------------------
// Rooms Index (active room list)
// --------------------
type RoomRec = { roomId: string; kind: "room"|"dm"|"rand"; lastActive: number; memberCount: number };

export class RoomsIndexDOv9 {
  state: DurableObjectState;
  constructor(state: DurableObjectState) { this.state = state; }

  private kindOf(roomId: string): RoomRec["kind"] {
    return roomId.startsWith("dm-") ? "dm" : roomId.startsWith("rand-") ? "rand" : "room";
  }

  async upsert(roomId: string, memberCount: number) {
    const now = Date.now();
    const kind = this.kindOf(roomId);
    const key = `room:${roomId}`;

    // 0人なら即削除（= 部屋一覧に残らない）
    if (memberCount <= 0) {
      await this.state.storage.delete(key);
      return;
    }
    await this.state.storage.put(key, { roomId, kind, lastActive: now, memberCount } satisfies RoomRec);
  }

  async list(limit: number) {
    const all = await this.state.storage.list<RoomRec>({ prefix: "room:" });
    const rooms = Array.from(all.values())
      .filter(r => (r.memberCount ?? 0) > 0)
      .sort((a,b)=> b.lastActive - a.lastActive)
      .slice(0, limit);
    return rooms;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/upsert" && request.method === "POST") {
      const body = await request.json().catch(()=> ({}));
      const roomId = String(body.roomId ?? "");
      const memberCount = Number(body.memberCount ?? 0);
      if (!roomId) return bad("missing roomId", 400);
      await this.upsert(roomId, memberCount);
      return json({ ok: true });
    }

    if (url.pathname === "/list") {
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "30")));
      const rooms = await this.list(limit);
      return json({ rooms });
    }

    return bad("not found", 404);
  }
}

// --------------------
// Room DO
// --------------------
export class RoomDOv9 {
  state: DurableObjectState;
  env: Env;
  clients = new Map<string, ClientInfo>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private roomIdFromRequest(request: Request): string {
    const url = new URL(request.url);
    // /ws/room/{roomId}
    const parts = url.pathname.split("/");
    return decodeURIComponent(parts.slice(3).join("/")) || "room";
  }

  private async updateIndex(roomId: string) {
    try {
      const id = this.env.INDEX.idFromName("rooms-index");
      const stub = this.env.INDEX.get(id);
      await stub.fetch(new Request("https://index/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, memberCount: this.clients.size }),
      }));
    } catch {}
  }

  private broadcast(obj: any, exceptId?: string) {
    const msg = JSON.stringify(obj);
    for (const [id, c] of this.clients) {
      if (exceptId && id === exceptId) continue;
      try { c.ws.send(msg); } catch {}
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId") ?? "";
    const name = url.searchParams.get("name") ?? "User";
    if (!clientId) return new Response("missing clientId", { status: 400 });

    const roomId = this.roomIdFromRequest(request);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    this.clients.set(clientId, { clientId, name, ws: server });

    const members = Array.from(this.clients.values()).map(c => ({ clientId: c.clientId, name: c.name }));
    server.send(JSON.stringify({ type: "joined", roomId, members }));
    this.broadcast({ type: "member_joined", clientId, name }, clientId);

    // join -> upsert
    await this.updateIndex(roomId);

    server.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(String(ev.data));
        if (data?.type === "signal") {
          const to = String(data.to ?? "");
          const payload = data.payload;
          const dest = this.clients.get(to);
          if (dest) dest.ws.send(JSON.stringify({ type: "signal", from: clientId, to, payload }));
        }
      } catch {}
    });

    const cleanup = async () => {
      const existed = this.clients.delete(clientId);
      if (existed) {
        this.broadcast({ type: "member_left", clientId });
        // leave -> upsert (0人なら削除)
        await this.updateIndex(roomId);
      }
    };

    server.addEventListener("close", () => { cleanup(); });
    server.addEventListener("error", () => { cleanup(); });

    return new Response(null, { status: 101, webSocket: client });
  }
}

// --------------------
// Lobby DO (instant match)
// --------------------
export class LobbyDOv9 {
  state: DurableObjectState;
  waiting: ClientInfo[] = [];

  constructor(state: DurableObjectState) { this.state = state; }

  private tryMatchOnce(max: number): boolean {
    const count = this.waiting.length;
    if (count < 2) return false;

    const take = Math.min(max, count);
    if (take < 2) return false;

    const group = this.waiting.splice(0, take);
    const roomId = `rand-${crypto.randomUUID().slice(0, 8)}`;
    const members = group.map(c => ({ clientId: c.clientId, name: c.name }));

    for (const c of group) {
      try { c.ws.send(JSON.stringify({ type: "match", roomId, members })); } catch {}
      try { c.ws.close(1000, "matched"); } catch {}
    }
    return true;
  }

  private matchAsMuchAsPossible(max: number) {
    while (this.tryMatchOnce(max)) {}
  }

  async alarm() {
    const lastMax = (await this.state.storage.get<number>("lastMax")) ?? 4;
    this.matchAsMuchAsPossible(lastMax);
    if (this.waiting.length >= 2) this.state.setAlarm(Date.now() + 2_000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId") ?? "";
    const name = url.searchParams.get("name") ?? "User";
    const max = Math.max(2, Math.min(6, Number(url.searchParams.get("max") ?? "4")));
    if (!clientId) return new Response("missing clientId", { status: 400 });

    await this.state.storage.put("lastMax", max);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const info: ClientInfo = { clientId, name, ws: server };
    this.waiting.push(info);

    const cleanup = () => { this.waiting = this.waiting.filter(x => x.clientId !== clientId); };
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    this.matchAsMuchAsPossible(max);
    if (this.waiting.length >= 2) this.state.setAlarm(Date.now() + 500);

    return new Response(null, { status: 101, webSocket: client });
  }
}
