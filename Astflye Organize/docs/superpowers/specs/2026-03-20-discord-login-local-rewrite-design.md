# Design: Discord Login + Local JSON Storage Rewrite

**Date:** 2026-03-20
**Branch:** feature/astflye-life-phase1
**Status:** Approved by user

---

## Summary

Full rewrite of the Astflye app architecture:
- Remove the separate `server/` binary entirely (Fiber + SQLite + GORM)
- Embed all logic inside the Wails desktop app
- Discord OAuth2 login: fresh every launch, no cached credentials, no refresh tokens
- Data persistence: local JSON files (no database)
- User info: collected on login, stored in memory only for the session

---

## Architecture

### Before
```
server/ (separate binary)
  ├── Fiber HTTP server (port 3005)
  ├── SQLite via GORM
  ├── Auth handlers (login, callback, refresh, logout)
  ├── Task/Finance/Social handlers
  └── models/ (User, Task, Finance, RefreshToken, ...)

app/ (Wails binary)
  ├── app.go  ← loopback listener + Wails bridge
  └── frontend/ ← React SPA
```

### After
```
app/ (single Wails binary — no separate server)
  ├── app.go      ← Discord OAuth login + loopback + user info getters
  ├── auth.go     ← Discord API helpers (FetchUser, IsGuildMember, JWT)
  ├── data.go     ← CRUD for tasks + finance (read/write JSON files)
  ├── main.go     ← Wails runner
  └── frontend/   ← React SPA (bridge calls replace fetch calls)

server/           ← DELETED entirely
```

---

## Login Flow

1. App starts → no token in memory → React shows `/login` page
2. User clicks "Login com Discord"
3. Go (`StartLogin`):
   - Starts a temporary loopback HTTP server on a random free port
   - Starts embedded OAuth server on port 3005 (or configurable)
   - Requests Discord OAuth URL from its own embedded server (or builds it directly)
   - Opens system browser to Discord authorize URL
4. User authorizes on Discord
5. Discord redirects to `http://localhost:3005/auth/callback?code=...&state=...`
6. Embedded OAuth server (`Callback`):
   - Validates CSRF state
   - Exchanges code for Discord access token
   - Calls `GET /users/@me` → fetches DiscordUser (id, username, global_name, avatar, discriminator)
   - Calls `GET /users/@me/guilds` → verifies user is in the configured Discord guild
   - If not in guild → redirects to loopback with `?error=not_member`
   - Issues a short-lived JWT (8h, signed with in-memory secret)
   - Redirects to loopback: `http://127.0.0.1:{port}/auth/done?token=JWT&username=X&global_name=X&avatar=URL&discord_id=X`
7. Loopback handler (`listenForTokens`):
   - Captures token + user fields
   - Stores in `App` struct memory (no disk write)
   - Fires Wails event `auth:success`
   - Serves a "Login realizado! Pode fechar esta aba." HTML page
   - Shuts down loopback server
8. Frontend (`LoginPage.tsx`) listens for `auth:success`:
   - Reads token + user info via Wails bridge (`GetAccessToken`, `GetUsername`, etc.)
   - Sets Zustand auth store in memory
   - Navigates to `/`

**Session lifecycle:** Token and user info exist only in Go struct memory. App close = session gone. Next launch = fresh Discord login required.

---

## Data Storage

### Location
- Windows: `%AppData%\Astflye\` (resolved via `os.UserConfigDir()`)
- Files: `tasks.json`, `finance.json`

### Format
Each file is a JSON array of records, e.g.:
```json
[
  { "id": "uuid", "user_discord_id": "123456", "title": "...", "status": "pending", "created_at": "..." }
]
```

Records are associated to the logged-in user via `user_discord_id` (Discord snowflake ID, stable identifier).

### Wails Bridge Functions (exposed via `data.go`)
Tasks:
- `GetTasks() []Task`
- `CreateTask(title, description, priority string) Task`
- `UpdateTask(id, title, description, priority, status string) error`
- `DeleteTask(id string) error`
- `UpdateTaskStatus(id, status string) error`

Finance:
- `GetTransactions() []Transaction`
- `CreateTransaction(amount float64, category, description, type_ string) Transaction`
- `UpdateTransaction(id string, amount float64, category, description string) error`
- `DeleteTransaction(id string) error`
- `GetFinanceSummary() FinanceSummary`

### File R/W pattern
- On read: load JSON file → decode → filter by `user_discord_id` → return
- On write: load → modify slice → encode → write back atomically (write to temp file, rename)

---

## JWT

- Issued by Go (in-memory secret loaded from env or auto-generated at startup)
- Used only to authorize Wails bridge calls that need to confirm session is active
- **No refresh token** — session ends when app closes
- Expiry: 8 hours
- If JWT expires mid-session, user sees a "sessão expirada" message and must login again

---

## Config

Minimal config loaded from a `.env` file next to the binary (or env vars):

```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GUILD_ID=...
DISCORD_REDIRECT_URI=http://localhost:3005/auth/callback
JWT_SECRET=...          # optional: auto-generated if missing
```

`DISCORD_BOT_TOKEN`, `DISCORD_ADMIN_ROLE`, `JWT_REFRESH_SECRET`, `DB_PATH`, `CLAUDE_API_KEY`, `PORT` — all removed.

---

## Files Changed

### Deleted
- `server/` — entire directory
- `app/frontend/wailsjs/go/main/App.d.ts` and `App.js` — regenerated by Wails
- `start-server.bat`

### Created/Rewritten in `app/`
- `app/auth.go` — Discord OAuth helpers + JWT (no GORM, no DB)
- `app/data.go` — JSON file CRUD for tasks + finance
- `app/app.go` — rewritten: StartLogin, loopback, user getters, Logout

### Modified
- `app/main.go` — embed embedded OAuth server startup
- `app/frontend/src/store/auth.ts` — remove refreshToken
- `app/frontend/src/pages/LoginPage.tsx` — remove browser dev mode fetch path complexity
- `app/frontend/src/pages/AuthDonePage.tsx` — remove refresh param
- `app/frontend/src/lib/api.ts` — replace fetch calls with Wails bridge calls
- `app/frontend/src/pages/TasksPage.tsx` — use bridge
- `app/frontend/src/pages/FinancePage.tsx` — use bridge
- `app/main.go` — startup: load config, start embedded OAuth server, bind App

---

## Error Cases

| Scenario | Behavior |
|---|---|
| User not in Discord guild | Loopback receives `?error=not_member`, frontend shows "Você precisa entrar no servidor Discord primeiro" |
| Discord API down | Loopback receives `?error=discord_error`, frontend shows generic error |
| Port 3005 already in use | Log warning, try next port up |
| JSON file corrupt/missing | Return empty array, recreate file on next write |
| JWT expired mid-session | Bridge calls return 401-equivalent error, frontend clears store and redirects to `/login` |

---

## Out of Scope

- Social/WebSocket features (existing code untouched or removed with server)
- Assistant (Claude API) — removed with server for now
- Streaks — can be added to `data.go` later
- Multi-user — single local user only (identified by Discord ID)
