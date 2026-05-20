# AGENTS.md — migra

## Project structure

- **`backend/index.js`** — Express 5 + WebSocket server. All API routes and migration logic live here.
- **`backend/proxmox.js`** — `ProxmoxClient` class wrapping the Proxmox API via axios.
- **`frontend/index.html`** — Single-file SPA (no framework, vanilla JS and CSS). Served by Express as static files.
- **`config/hosts.json`** — Host credentials (gitignored). Auto-created if missing.
- **`manage.sh`** — Systemd service manager (requires root/sudo).

## Commands

| What | Command |
|------|---------|
| Start dev server | `npm start` (runs `node backend/index.js`) |
| Service install | `sudo ./manage.sh install` |
| Service start | `sudo ./manage.sh start` |
| Service stop | `sudo ./manage.sh stop` |
| Service status | `sudo ./manage.sh status` |
| Service restart | `sudo ./manage.sh restart` |

No test, lint, typecheck, or build commands exist.

## Architecture notes

- **ESM only** (`"type": "module"` in package.json). Imports use `import`/`export`, no `require()`.
- **Port**: defaults to `3001`, override via `PORT` env var.
- **Proxmox API**: HTTPS on port `8006` with self-signed certs — `rejectUnauthorized: false` is hardcoded.
- **Auth**: supports password (ticket) and API token (`PVEAPIToken=USER@REALM!TOKENID=SECRET`). Token format in config is `"TOKENID=SECRET"`.
- **WebSocket**: single `/` endpoint. Client sends `START_MIGRATION` and `CONFIRM_CLEANUP` message types. Server sends `LOG` (with optional `PROGRESS:N%` prefix) and `ERROR` types.
- **Migration flow**: Stop → Backup (vzdump, zstd, mode=stop) → Restore → Start → await cleanup confirmation.
- **Cleanup**: user-initiated via WS after migration success. Deletes source LXC and backup archive.
- **Dependencies**: express@5, ws, axios, cors, helmet, morgan, dotenv.
- **No database** — config/hosts.json is the only persistent state.
