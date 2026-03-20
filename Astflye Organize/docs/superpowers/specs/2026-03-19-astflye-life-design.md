# Astflye Life — Design Specification

**Date:** 2026-03-19
**Status:** Approved
**Author:** Claude (brainstorming session)

---

## 1. Overview

Astflye Life is a self-hosted desktop productivity and life management application. Users manage daily tasks, track finances, and communicate with friends — all through a gaming-inspired dark UI. Authentication is gated by Discord server membership.

### Goals
- Help users organize routines (daily/weekly/monthly/yearly tasks)
- Track personal finances (income, expenses, summaries)
- Connect with a friend group via Discord-linked accounts
- Survive PC formatting (data lives on the server, not the desktop)

### Non-Goals (out of scope for MVP)
- Mobile app
- Public cloud hosting
- Payment processing
- Third-party calendar sync

---

## 2. Architecture

### Approach: Two binaries, one monorepo

```
astflye-life/
├── server/      → Go API server (runs 24/7, self-hosted)
├── app/         → Wails desktop app (installed on each user's PC)
└── shared/      → Shared Go types
```

**Communication:** REST API + WebSocket over HTTP. Desktop app connects to the server via configurable base URL (LAN or port-forwarded public IP). JWT tokens authenticate every request.

**Data persistence:** SQLite database on the server machine. Survives desktop reinstalls — users reconnect and all data is restored. GitHub is used only for source code version control.

---

## 3. Folder Structure

```
astflye-life/
├── .env.example
├── .gitignore
├── README.md
│
├── server/
│   ├── main.go
│   ├── config/config.go          # env loading + validation
│   ├── auth/
│   │   ├── discord.go            # OAuth2 + guild membership check
│   │   └── jwt.go                # issue/validate JWT
│   ├── handlers/
│   │   ├── tasks.go
│   │   ├── finance.go
│   │   ├── social.go
│   │   └── chat.go
│   ├── models/
│   │   ├── user.go
│   │   ├── task.go
│   │   ├── finance.go
│   │   ├── message.go
│   │   ├── team.go
│   │   └── refresh_token.go
│   ├── middleware/
│   │   ├── auth.go               # JWT validation
│   │   └── ratelimit.go
│   ├── db/db.go                  # GORM + SQLite + auto-migrate
│   └── ws/hub.go                 # WebSocket connection manager
│
├── app/
│   ├── main.go                   # Wails entry point
│   ├── app.go                    # Go↔JS bindings
│   ├── wails.json
│   └── frontend/
│       ├── next.config.js        # output: 'export'
│       └── src/
│           ├── app/              # Next.js app router
│           ├── components/
│           │   ├── layout/       # Sidebar, Layout
│           │   ├── tasks/
│           │   ├── finance/
│           │   ├── social/
│           │   └── ui/           # shared primitives
│           ├── hooks/
│           ├── lib/
│           │   ├── api.ts        # typed fetch wrapper
│           │   └── ws.ts         # WebSocket client
│           └── store/            # Zustand
│
└── shared/types/models.go
```

---

## 4. Data Models

### User
| Field | Type | Notes |
|---|---|---|
| ID | string (UUID) | internal ID, never changes |
| DiscordID | string | unique, used for friend lookup |
| Username | string | Discord display name |
| Avatar | string | Discord avatar URL |
| CurrentStreak | int | consecutive active days |
| LongestStreak | int | all-time best streak |
| LastActiveDate | *time.Time | last day with a completed task |
| CreatedAt | time.Time | |

### Task
| Field | Type | Notes |
|---|---|---|
| ID | string | |
| UserID | string | owner |
| Title | string | |
| Description | string | |
| Status | string | pending \| completed \| skipped \| in_progress |
| Priority | string | low \| medium \| high \| urgent |
| Category | string | user-defined |
| Tags | []string | JSON |
| Recurrence | string | none \| daily \| weekly \| monthly \| yearly |
| DueDate | time.Time | |
| CompletedAt | *time.Time | nullable |
| CreatedAt | time.Time | |

### Transaction
| Field | Type | Notes |
|---|---|---|
| ID | string | |
| UserID | string | |
| Type | string | income \| expense |
| Amount | float64 | |
| Currency | string | BRL default |
| Category | string | food \| transport \| health \| salary \| etc. |
| Description | string | |
| Recurring | bool | |
| Frequency | string | once \| daily \| weekly \| monthly \| yearly |
| Date | time.Time | |
| CreatedAt | time.Time | |

### Friendship
| Field | Type | Notes |
|---|---|---|
| ID | string | |
| UserID | string | requester |
| FriendID | string | receiver |
| Status | string | pending \| accepted \| blocked |
| CreatedAt | time.Time | |

### Team
| Field | Type | Notes |
|---|---|---|
| ID | string | |
| Name | string | |
| OwnerID | string | |
| CreatedAt | time.Time | |
| Members | via TeamMember | many-to-many join table |

### TeamMember
| Field | Type | Notes |
|---|---|---|
| TeamID | string | FK → Team.ID |
| UserID | string | FK → User.ID |
| Role | string | member \| admin |
| JoinedAt | time.Time | |

### RefreshToken
| Field | Type | Notes |
|---|---|---|
| ID | string (UUID) | |
| UserID | string | FK → User.ID |
| TokenHash | string | bcrypt hash of the raw token |
| ExpiresAt | time.Time | 30-day expiry |
| CreatedAt | time.Time | |

### Message
| Field | Type | Notes |
|---|---|---|
| ID | string | |
| SenderID | string | |
| ReceiverID | string | user or team ID |
| ChatType | string | direct \| team |
| Content | string | |
| ReadAt | *time.Time | nullable |
| CreatedAt | time.Time | |

---

## 5. Authentication Flow

```
1. User clicks "Login with Discord"
2. Server generates a short-lived random state value (stored in memory, 5 min TTL)
3. App opens system browser → Discord OAuth2 authorize URL
   scope: identify + guilds, params: state=<random>
4. Discord redirects to server: GET /auth/callback?code=...&state=...
5. Server validates state matches stored value (CSRF protection); rejects if mismatch
6. Server exchanges code → Discord access token
7. Server fetches user profile + guild memberships from Discord API
8. Server checks guild_id presence in memberships
   → NOT MEMBER: return 403, prompt user to join server
   → MEMBER: upsert User record in SQLite
9. Server issues JWT (24h access token, signed with JWT_SECRET)
   + refresh token (30d, hashed and stored in RefreshToken table)
10. Server redirects browser to: http://localhost:34115/auth/done?token=<jwt>&refresh=<refresh>
    The Wails app's embedded Go process has a temporary HTTP listener on port 34115 waiting for this callback.
11. Wails handler receives tokens, stores both in memory (never written to disk), closes the listener
12. Browser tab can be closed; app is now authenticated
13. All API requests: Authorization: Bearer <access_token>
14. When access token expires: POST /auth/refresh with refresh token → new access token
15. On logout: POST /auth/logout → server deletes RefreshToken row → both tokens discarded in app memory
```

**Security constraints:**
- `DISCORD_REDIRECT_URI` must be registered in the Discord Developer Portal → OAuth2 → Redirects whitelist before any login attempt will work
- Discord client secret lives only in `server/.env`
- JWT signing secret in `.env`, rotated on server restart optionally
- No secrets in source code or committed files
- Desktop app never has access to Discord client secret

---

## 6. API Routes

```
# Auth
GET    /auth/callback              Discord OAuth callback + guild check (GET — browser redirect)
POST   /auth/refresh               Refresh JWT (returns new access token)
POST   /auth/logout                Revoke refresh token (deletes RefreshToken row)

# Users
GET    /users/me                   Current user profile
GET    /users/:id                  Public user profile

# Tasks
GET    /tasks                      List (filter: status, recurrence, category)
POST   /tasks                      Create
PUT    /tasks/:id                  Update
DELETE /tasks/:id                  Delete
PATCH  /tasks/:id/status           Change status

# Finance
GET    /finance/transactions       List (filter: type, category, date range)
POST   /finance/transactions       Add transaction
PUT    /finance/transactions/:id   Update transaction
DELETE /finance/transactions/:id   Delete
GET    /finance/summary            Totals by period (daily/weekly/monthly/yearly)
GET    /finance/categories         Spending breakdown

# Social
GET    /social/friends             Friend list
POST   /social/friends             Send friend request (Discord ID)
PATCH  /social/friends/:id         Accept / block
GET    /social/teams               My teams
POST   /social/teams               Create team
POST   /social/teams/:id/members   Add member

# Real-time
WS     /ws                         Chat + notifications WebSocket

# Admin (requires DISCORD_ADMIN_ROLE)
GET    /admin/users                List all users
DELETE /admin/users/:id            Ban user
```

### WebSocket Message Envelope

All WebSocket messages use a typed JSON envelope:

```json
{ "type": "<event_type>", "payload": { ... } }
```

| type | direction | payload |
|---|---|---|
| `message.send` | client → server | `{ to: string, chatType: "direct"\|"team", content: string }` |
| `message.receive` | server → client | `{ from: string, chatType: string, content: string, createdAt: string }` |
| `notification` | server → client | `{ title: string, body: string, kind: "task"\|"friend"\|"system" }` |
| `presence.online` | server → client | `{ userId: string }` |
| `presence.offline` | server → client | `{ userId: string }` |
| `ping` | client → server | `{}` |
| `pong` | server → client | `{}` |

---

## 7. Tech Stack

### Server
| Package | Purpose |
|---|---|
| `gofiber/fiber/v2` | HTTP router |
| `gorm.io/gorm` + `gorm.io/driver/sqlite` | ORM + SQLite |
| `golang.org/x/oauth2` | Discord OAuth2 |
| `golang-jwt/jwt/v5` | JWT issue/validate |
| `gorilla/websocket` | WebSocket hub |
| `joho/godotenv` | .env loading |

### Desktop App (Frontend)
| Package | Purpose |
|---|---|
| Next.js 14 (static export) | Pages + routing |
| Tailwind CSS | Styling |
| shadcn/ui | Component primitives |
| Framer Motion | Animations |
| Recharts | Finance charts |
| Zustand | Global state |
| TanStack Query | Server state + caching |

### Design System
- **Primary color:** `#b455ff` (neon purple)
- **Accent color:** `#ff55aa` (neon pink)
- **Background:** `#08050f` (near black)
- **Surface:** `#110820` (dark purple-tinted)
- **Text:** `#e0d0ff` (soft lavender white)
- **Style:** Galaxy / Neon Purple — rounded corners, gradient progress bars, glow effects
- **Navigation:** Expanded sidebar with icons + labels (collapsible)

---

## 8. Motivational Assistant

### Rule-based (always on)
- Triggered by: streak milestones, task completions, daily progress %
- Examples: "7-day streak! You're unstoppable." / "3 tasks left for today, finish strong."
- Logic lives in server, no external calls

### AI-powered (optional, requires API key)
- Uses Claude API (configurable model)
- Sends anonymized summary: task completion %, streak, financial goal progress
- Returns personalized motivational message + actionable suggestion
- Enabled via `CLAUDE_API_KEY` in `.env`; disabled gracefully if not set

---

## 9. Environment Variables

```bash
# server/.env (never committed)

# Discord OAuth2 (login + guild check)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:3005/auth/callback
DISCORD_GUILD_ID=           # users must be in this guild to access the app

# Discord Bot (used by admin endpoints to verify admin role + send DM notifications)
DISCORD_BOT_TOKEN=
DISCORD_ADMIN_ROLE=         # Discord role ID that grants access to /admin/* routes

# Server
PORT=3005
JWT_SECRET=
JWT_REFRESH_SECRET=

# Database
DB_PATH=./data/astflye.db

# AI Assistant (optional)
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6

# CORS (desktop app origin)
ALLOWED_ORIGIN=http://localhost:34115
```

---

## 10. MVP Roadmap

### Phase 1 — Foundation
- Monorepo setup with Go modules
- Server: Fiber + GORM + SQLite + config loading
- Discord OAuth2 + guild membership check + JWT
- Wails app shell + Next.js + Tailwind + sidebar navigation
- Auth flow end-to-end

### Phase 2 — Core Features
- Task system: CRUD + status transitions + recurrence + priorities + tags
- Financial system: transactions + categories + summary queries
- Dashboard: streak counter, daily progress, balance widget
- Finance charts: Recharts weekly/monthly income vs expense

### Phase 3 — Social
- Friend system: add by Discord ID, accept/block
- Team system: create, add members, shared view
- Real-time chat: WebSocket hub, direct messages, team channels
- Online status indicators

### Phase 4 — Polish
- Rule-based motivational assistant
- Claude API integration (optional AI mode)
- In-app notifications
- Settings page: server URL, AI toggle, theme preferences
- README + .env.example + initial git push

---

## 11. Security Checklist

- [ ] All secrets in `.env`, `.env` in `.gitignore`
- [ ] JWT signed with strong random secret (min 32 bytes)
- [ ] Discord OAuth state parameter to prevent CSRF
- [ ] Rate limiting on auth endpoints
- [ ] Guild membership re-validated on JWT refresh
- [ ] No user data in JWT payload beyond user ID
- [ ] SQLite file permissions restricted on server machine
- [ ] WebSocket connections require valid JWT
- [ ] CORS restricted to Wails app origin
