# Study：通話(音声/ビデオ)＋チャット＋ランダム通話＋プライベートルーム

## 起動
### 1) シグナリング（Cloudflare Worker）
```bash
cd worker
npm i -g wrangler
wrangler login
npm i
wrangler deploy
```

### 2) Web
`web/.env.local`
```env
NEXT_PUBLIC_SIGNALING_BASE=https://YOUR-WORKER-URL
```

```bash
cd web
npm i
npm run dev
```

http://localhost:3000
