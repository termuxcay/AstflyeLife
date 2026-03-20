# Design: Discord Login + Local JSON Storage Rewrite

**Date:** 2026-03-20
**Branch:** feature/astflye-life-phase1
**Status:** Approved by user — v2 (post spec-review fixes)

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
  ├── app.go      ← StartLogin, loopback, user info getters, Logout
  ├── auth.go     ← Discord API helpers + JWT + embedded OAuth HTTP server
  ├── data.go     ← CRUD for tasks + finance (read/write JSON files, with mutex)
  ├── config.go   ← load config from .env / env vars
  ├── main.go     ← Wails runner (starts embedded OAuth server on startup)
  └── frontend/   ← React SPA (bridge calls replace all fetch calls)

server/           ← DELETED entirely
```

---

## Login Flow

1. App starts → Wails starts embedded OAuth HTTP server on **fixed port 3005** → no token in memory → React shows `/login` page
2. User clicks "Login com Discord"
3. Go (`App.StartLogin`):
   - Starts a temporary loopback HTTP server on a **random free port** (this is the `done_url` receiver)
   - Builds the Discord OAuth2 authorize URL directly in Go (no HTTP call to self) using `oauth2.Config.AuthCodeURL(state)`
   - Opens system browser to Discord authorize URL via `runtime.BrowserOpenURL`
4. User authorizes on Discord
5. Discord redirects to `http://localhost:3005/auth/callback?code=...&state=...` (fixed port)
6. Embedded OAuth server (`authHandler` in `auth.go`):
   - Validates CSRF state token
   - Exchanges code for Discord OAuth2 token
   - Calls Discord `GET /users/@me` → fetches `DiscordUser` (id, username, global_name, avatar, discriminator)
   - Calls Discord `GET /users/@me/guilds` → verifies user is in the configured guild ID
   - If **not in guild** → redirects to loopback with `?error=not_member`
   - If **Discord API error** → redirects to loopback with `?error=discord_error`
   - Issues a session JWT (8h, signed with secret from config)
   - Redirects to loopback: `http://127.0.0.1:{randomPort}/auth/done?token=JWT&username=X&global_name=X&avatar=URL&discord_id=X`
7. Loopback handler (`listenForTokens` in `app.go`):
   - Captures token, username, globalName, avatar, discordID from query params
   - Stores all in `App` struct fields **in memory only** (no disk write)
   - Fires Wails event `auth:success`
   - Serves a "Login realizado! Pode fechar esta aba." HTML page
   - Shuts down loopback server (the embedded OAuth server on 3005 keeps running)
8. Frontend (`LoginPage.tsx`) listens for `auth:success` Wails event:
   - Calls bridge getters: `GetAccessToken()`, `GetUsername()`, `GetGlobalName()`, `GetAvatar()`, `GetDiscordID()`
   - Sets Zustand auth store in memory
   - Navigates to `/`

**Session lifecycle:** Token and user info exist only in Go struct memory. App close = session gone. Next launch = fresh Discord login required.

**Port 3005 is fixed** — Discord's OAuth app requires an exact redirect URI match. Dynamic port fallback is NOT supported for the callback listener. Only the loopback receiver (`done_url`) uses a dynamic port.

**done_url coordination between `app.go` and `auth.go`:** `StartLogin` allocates the random loopback port, constructs `done_url`, then calls `stateStore.Generate(done_url)`. The CSRF state token carries the `done_url` encoded inside it. When the OAuth callback fires, `auth.go` calls `stateStore.Consume(state)` to recover the `done_url` and redirect there. The `stateStore` is a field on the `App` struct, shared between `app.go` (login initiator) and the embedded HTTP handler in `auth.go`. This is identical to the existing `StateStore` pattern in `server/auth/discord.go`.

---

## Data Storage

### Location
Config and data stored in `os.UserConfigDir()/Astflye/` (resolves to `%AppData%\Astflye\` on Windows):
- `tasks.json`
- `finance.json`
- `.env` (config file — see Config section)

### Record Format
Each file is a JSON array. Records include `user_discord_id` to scope data per user:

```json
[
  {
    "id": "uuid",
    "user_discord_id": "123456789",
    "title": "My task",
    "description": "",
    "status": "pending",
    "priority": "medium",
    "category": "",
    "recurrence": "none",
    "due_date": "",
    "completed_at": "",
    "created_at": "2026-03-20T12:00:00Z"
  }
]
```

### Wails Bridge Functions — Tasks (`data.go`)

Go types (serialized to/from JSON via Wails):
```go
type Task struct {
    ID          string `json:"id"`
    UserDiscordID string `json:"user_discord_id"`
    Title       string `json:"title"`
    Description string `json:"description"`
    Status      string `json:"status"`      // pending|in_progress|completed|skipped
    Priority    string `json:"priority"`    // low|medium|high|urgent
    Category    string `json:"category"`
    Recurrence  string `json:"recurrence"`  // none|daily|weekly|monthly|yearly
    DueDate     string `json:"due_date"`
    CompletedAt string `json:"completed_at"`
    CreatedAt   string `json:"created_at"`
}

type TaskInput struct {
    Title       string `json:"title"`
    Description string `json:"description"`
    Status      string `json:"status"`
    Priority    string `json:"priority"`
    Category    string `json:"category"`
    Recurrence  string `json:"recurrence"`
    DueDate     string `json:"due_date"`
}
```

Bridge methods:
- `GetTasks() ([]Task, error)`
- `CreateTask(input TaskInput) (Task, error)`
- `UpdateTask(id string, input TaskInput) error`
- `UpdateTaskStatus(id string, status string) error`
- `DeleteTask(id string) error`

### Wails Bridge Functions — Finance (`data.go`)

```go
type Transaction struct {
    ID            string  `json:"id"`
    UserDiscordID string  `json:"user_discord_id"`
    Type          string  `json:"type"`        // income|expense
    Amount        float64 `json:"amount"`
    Currency      string  `json:"currency"`
    Category      string  `json:"category"`
    Description   string  `json:"description"`
    Recurring     bool    `json:"recurring"`
    Date          string  `json:"date"`
    CreatedAt     string  `json:"created_at"`
}

type TransactionInput struct {
    Type        string  `json:"type"`
    Amount      float64 `json:"amount"`
    Currency    string  `json:"currency"`
    Category    string  `json:"category"`
    Description string  `json:"description"`
    Recurring   bool    `json:"recurring"`
    Date        string  `json:"date"`
}

type FinanceSummary struct {
    Income   float64 `json:"income"`
    Expenses float64 `json:"expenses"`
    Balance  float64 `json:"balance"`
    Period   string  `json:"period"`
}
```

Bridge methods:
- `GetTransactions() ([]Transaction, error)`
- `CreateTransaction(input TransactionInput) (Transaction, error)`
- `UpdateTransaction(id string, input TransactionInput) error`
- `DeleteTransaction(id string) error`
- `GetFinanceSummary(period string) (FinanceSummary, error)`
- `GetCategories() ([]string, error)` — derives from unique categories in `finance.json`

### File R/W Pattern
- Each file type has its own `sync.RWMutex` in `data.go`
- On read: `RLock` → load JSON → decode → filter by `user_discord_id` → `RUnlock` → return
- On write: `Lock` → load JSON → modify slice → encode → write to temp file → rename (atomic) → `Unlock`

---

## User Info (`useMe` replacement)

The `useMe` hook no longer calls an HTTP endpoint. Instead it reads from the Zustand auth store which is populated at login from bridge getters.

`useMe` returns a synthetic user object:
```ts
{
  discord_id:    GetDiscordID()   // from bridge
  username:      store.user.username
  global_name:   store.user.globalName
  avatar:        store.user.avatar
  // current_streak, longest_streak: out of scope (removed from UI)
  // created_at: not tracked
}
```

`useMe` hook becomes a simple Zustand selector — no `useQuery`, no network call.

---

## JWT / Session

- JWT issued by Go in `auth.go`, signed with secret from config
- Expiry: 8 hours
- JWT stored in `App.accessToken` (memory only)
- Bridge session check: `App.IsAuthenticated()` returns `accessToken != ""` — no per-call JWT validation (local IPC, no HTTP)
- Frontend session check: `useAuthStore.isAuthenticated()` returns `!!accessToken`
- Mid-session expiry: not auto-detected (8h is long enough for a session); if needed, add `App.IsSessionValid()` that checks JWT expiry

---

## Frontend Changes

### `app/frontend/src/lib/api.ts` — REPLACED
New `api.ts` becomes a thin Wails bridge wrapper:
```ts
// Calls window.go.main.App.* methods
// Returns typed results
// On error (method throws), propagates error to React Query
```
No more `fetch`, no more `SERVER_URL`, no more Bearer token headers.

### `app/frontend/src/hooks/useTasks.ts` — REWRITTEN
Uses `useQuery` with `queryFn: () => window.go.main.App.GetTasks()` etc.

### `app/frontend/src/hooks/useFinance.ts` — REWRITTEN
Uses `useQuery` with `queryFn: () => window.go.main.App.GetTransactions()` etc.

### `app/frontend/src/hooks/useMe.ts` — REWRITTEN
Pure Zustand selector, no `useQuery`.

### `app/frontend/src/hooks/useSocial.ts` — DELETED
Social feature removed. `SocialPage.tsx` shows a "Em breve" stub.

### `app/frontend/src/store/auth.ts` — SIMPLIFIED
Remove `refreshToken` field. Keep `accessToken`, `user` (username, globalName, avatar, discordID), `setTokens`, `clear`, `isAuthenticated`.

### `app/frontend/src/pages/AuthDonePage.tsx` — DELETED
Dead code after rewrite. The loopback response goes to the browser tab (plain HTML), not the Wails webview. Wails event `auth:success` is the mechanism.

### `app/frontend/src/main.tsx`
Remove `/auth/done` route (AuthDonePage deleted).

### `app/frontend/src/pages/ProfilePage.tsx`
`handleLogout` calls `window.go.main.App.Logout()` then `useAuthStore.getState().clear()` then `navigate('/login')`. No HTTP call.

### `app/frontend/src/pages/LoginPage.tsx`
Keep the Wails bridge path (`window.go.main.App.StartLogin`). Remove the browser-dev fallback path that called `fetch('/auth/login-url')`.

> **Dev mode note:** During `wails dev`, the Wails process starts the embedded OAuth server on port 3005. Vite's proxy to `/api → localhost:3005` is no longer needed (all data goes via bridge, not HTTP). `vite.config.ts` proxy can be removed.

---

## Config (`config.go` in `app/`)

Loaded from `os.UserConfigDir()/Astflye/.env` (falling back to env vars):

```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GUILD_ID=...
DISCORD_REDIRECT_URI=http://localhost:3005/auth/callback
JWT_SECRET=...   # auto-generated and saved if missing
```

Removed vs current server config: `DISCORD_BOT_TOKEN`, `DISCORD_ADMIN_ROLE`, `JWT_REFRESH_SECRET`, `DB_PATH`, `CLAUDE_API_KEY`, `PORT`, `AUTH_DONE_URL`, `ALLOWED_ORIGIN`, `CLAUDE_MODEL`.

---

## Files: Full Change List

### Deleted
- `server/` — entire directory
- `app/frontend/src/pages/AuthDonePage.tsx`
- `app/frontend/src/hooks/useSocial.ts`
- `start-server.bat`
- `app/frontend/wailsjs/go/main/App.d.ts` + `App.js` — regenerated by `wails dev`

### Created in `app/`
- `app/auth.go` — Discord OAuth2 helpers (FetchDiscordUser, IsGuildMember, AvatarURL, IssueJWT) + embedded `net/http` server (port 3005, handles `/auth/callback`)
- `app/data.go` — JSON CRUD for tasks + finance, with per-file mutex, atomic writes
- `app/config.go` — load config from `%AppData%\Astflye\.env`

### Rewritten in `app/`
- `app/app.go` — StartLogin (build OAuth URL directly, start loopback), listenForTokens, user getters (GetAccessToken, GetUsername, GetGlobalName, GetAvatar, GetDiscordID), Logout, IsAuthenticated
- `app/main.go` — startup: load config, start embedded OAuth server, bind App to Wails

### Rewritten in `app/frontend/`
- `app/frontend/src/lib/api.ts` — Wails bridge wrapper (no fetch/HTTP)
- `app/frontend/src/hooks/useTasks.ts` — bridge calls
- `app/frontend/src/hooks/useFinance.ts` — bridge calls
- `app/frontend/src/hooks/useMe.ts` — Zustand selector only
- `app/frontend/src/store/auth.ts` — remove refreshToken, add discordId to user
- `app/frontend/src/pages/LoginPage.tsx` — remove browser-dev fallback, keep Wails path
- `app/frontend/src/pages/ProfilePage.tsx` — logout via bridge
- `app/frontend/src/pages/SocialPage.tsx` — "Em breve" stub
- `app/frontend/src/main.tsx` — remove `/auth/done` route
- `app/frontend/vite.config.ts` — remove proxy

---

## Error Cases

| Scenario | Behavior |
|---|---|
| User not in Discord guild | Loopback receives `?error=not_member` → frontend shows "Você precisa entrar no servidor Discord" |
| Discord API error | Loopback receives `?error=discord_error` → frontend shows generic error |
| Port 3005 already in use | Log fatal at startup: "porta 3005 já em uso — feche o outro processo" |
| JSON file missing | Create empty array on first write |
| JSON file corrupt | Log warning, reset to empty array, overwrite |
| User closes browser without authorizing | Loopback times out after 5 minutes, fires `auth:timeout` event, frontend shows "Login cancelado" |

---

## Out of Scope

- Social / WebSocket features — `SocialPage` becomes stub
- Assistant (Claude API) — removed
- Streaks — removed from UI (no DB to track them)
- Multi-device / server sync — single local user only
