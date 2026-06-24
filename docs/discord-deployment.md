# Deploying Boredgame as a Discord Activity

This guide walks through hosting Boredgame for use as a [Discord Activity](https://discord.com/developers/docs/activities/building-an-activity).

---

## Architecture

```
┌──────────┐     WebSocket      ┌──────────┐
│  Client  │ ◄─────────────────► │  Server  │
│ (Vite /  │                     │ (ws /    │
│  Discord │                     │  Node.js)│
│  SDK)    │                     │          │
└──────────┘                     └──────────┘
     ▲                                │
     │         HTTPS                  │
     │   (Discord Activity URL)       │
     │                                │
┌────┴────┐                           │
│ Discord │                           │
│  App    │                           │
└─────────┘                           │
                                      ▼
                                ┌──────────┐
                                │  Room(s) │
                                │  ─────── │
                                │ actionLog│
                                │ snapshot │
                                └──────────┘
```

- **Server**: A Node.js WebSocket server (`@boredgame/server`) that hosts game rooms. Must be publicly reachable.
- **Client**: A Vite-built React app served via Discord's embedded browser. Communicates with the server over WebSocket.
- **Discord**: Provides authentication, Activity instance IDs, and participant enumeration via the Embedded App SDK.

---

## Prerequisites

1. **A Discord Application** — created in the [Discord Developer Portal](https://discord.com/developers/applications).
2. **Activity URL** — the HTTPS URL where your Vite-built frontend is hosted.
3. **A hosting provider** for the WebSocket server (and optionally the static frontend).

---

## Setting Up the Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application (or use an existing one).

2. Navigate to **Activity** → **General**:
   - Set **Activity URL** to your frontend URL (e.g. `https://your-app.com`).
   - Set **Activity Action** → **Launch** → **URL** to the same frontend URL.

3. Copy the **Client ID** from **OAuth2** → **General**. You'll need this for your frontend build.

---

## Building the Frontend

The frontend is a Vite + React app that uses `@boredgame/platform` for Discord integration.

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_DISCORD_CLIENT_ID` | Yes (Discord) | — | Your Discord app's Client ID |
| `VITE_WS_URL` | Yes | `ws://localhost:3001` | WebSocket server URL |

### Build

```bash
# Install dependencies
pnpm install

# Build for production
VITE_DISCORD_CLIENT_ID=your_client_id \
VITE_WS_URL=wss://your-server.com \
pnpm --filter sample-project build
```

The output will be in `sample-project/dist/`. Upload or serve this directory.

---

## Deploying the Server

### Option A: Docker (recommended)

A `Dockerfile` is provided at the project root.

```bash
# Build the image
docker build -t boredgame-server .

# Run it
docker run -d \
  --name boredgame-server \
  -p 3001:3001 \
  boredgame-server
```

### Option B: Railway

1. Create a new project on [Railway](https://railway.app).
2. Connect your repository.
3. Railway auto-detects `pnpm` and runs `pnpm install && pnpm start`.
4. Override the start command in `railway.json` or the dashboard:
   ```
   pnpm --filter @boredgame/server start
   ```
5. Set the public port to 3001.
6. Set environment variables via the dashboard.

### Option C: Fly.io

1. Install the [Fly CLI](https://fly.io/docs/getting-started/installing-flyctl/).
2. Create a `fly.toml`:

   ```toml
   app = "your-app-name"

   [build]
     dockerfile = "Dockerfile"

   [[services]]
     internal_port = 3001
     protocol = "tcp"
     [services.concurrency]
       hard_limit = 25
       soft_limit = 10
     [[services.ports]]
       handlers = ["tls"]
       port = 443
   ```

3. Deploy:

   ```bash
   fly launch
   fly deploy
   ```

### Option D: Cloudflare Workers (lightweight)

For very simple setups, you can adapt the WebSocket server to run on Cloudflare Workers using `@cfworker/websocket-polyfill` or Durable Objects. This requires significant rework and is recommended only for advanced users.

---

## Environment Variables Reference

| Variable | Where | Description |
|----------|-------|-------------|
| `PORT` | Server | WebSocket listen port (default `3001`) |
| `VITE_DISCORD_CLIENT_ID` | Frontend build | Discord Application Client ID |
| `VITE_WS_URL` | Frontend build | Server WebSocket URL (e.g. `wss://your-server.com`) |

---

## Production Checklist

- [ ] WebSocket server uses **HTTPS/WSS** (TLS). Set up a reverse proxy (nginx, Caddy) or use a platform that handles TLS termination.
- [ ] **CORS** is not needed for WebSocket connections, but any HTTP endpoints you add should configure CORS appropriately.
- [ ] **Action log pruning** is enabled by default (max 500 actions). Configure via `Room` constructor if needed.
- [ ] **Rate limiting**: Add a rate limiter upstream (nginx `limit_req`, Cloudflare rate limiting, etc.) for production with many concurrent players.
- [ ] **State persistence** is not included by default. For long-running games, consider periodically persisting room state to a database (Redis, SQLite, etc.).
- [ ] **Multiple server instances**: The in-memory `Map<string, Room>` does not scale across processes. For horizontal scaling, replace `Room` with a shared store (Redis pub/sub, etc.).

---

## CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs tests and builds on push to `main`. Extend it to deploy:

```yaml
# Example deploy step (add to ci.yml)
- name: Deploy to Railway
  run: npx railway up
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## Testing the Deployment

1. Open your Discord Application's Activity URL in a browser.
2. Confirm the connection banner shows "Connected".
3. Open a second browser tab with the same URL to simulate a second player.
4. Verify that moves from one player appear on the other's board.

To test inside Discord:

1. In the Developer Portal, navigate to **Activity** → **Test Mode**.
2. Click **Open Activity** in a voice channel or DM.
3. Confirm the Discord SDK initializes and the game loads.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| "MISSING_PLAYER_ID" | `playerId` query param not set | Ensure the platform provider passes `playerId` |
| "INCOMPATIBLE_VERSION" | Client/server protocol mismatch | Deploy matching versions of client and server |
| Connection refused | WebSocket server not reachable | Check firewall, TLS, and port forwarding |
| Discord SDK auth fails | Wrong `VITE_DISCORD_CLIENT_ID` | Verify Client ID in Developer Portal |
| Blank screen after auth | SPA routing issue | Ensure Vite SPA fallback is configured |
