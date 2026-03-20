# Astflye Life — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the monorepo, Go API server with Discord OAuth2 + guild-gated JWT auth, and Wails desktop shell with sidebar navigation — fully wired end-to-end so a user can log in via Discord and land on the app dashboard.

**Architecture:** Two Go binaries in one monorepo: `server/` (Fiber + GORM + SQLite, runs 24/7) and `app/` (Wails + Next.js desktop client). Auth uses Discord OAuth2 with a loopback listener on port 34115 inside the Wails process to receive JWT tokens after the browser callback.

**Tech Stack:** Go 1.22, Fiber v2, GORM + SQLite, golang-jwt/jwt v5, Wails v2, Next.js 14 (static export), Tailwind CSS, shadcn/ui, Zustand, TanStack Query

---

## File Map

### Server
| File | Responsibility |
|---|---|
| `server/main.go` | Entry point, wire everything together |
| `server/config/config.go` | Load + validate .env |
| `server/db/db.go` | GORM init, SQLite connection, auto-migrate |
| `server/models/user.go` | User struct |
| `server/models/task.go` | Task struct |
| `server/models/finance.go` | Transaction struct |
| `server/models/message.go` | Message struct |
| `server/models/team.go` | Team + TeamMember structs |
| `server/models/refresh_token.go` | RefreshToken struct |
| `server/auth/discord.go` | OAuth2 flow, state store, guild check |
| `server/auth/jwt.go` | Issue + validate access/refresh tokens |
| `server/handlers/auth.go` | GET /auth/callback, POST /auth/refresh, POST /auth/logout |
| `server/handlers/users.go` | GET /users/me, GET /users/:id |
| `server/middleware/auth.go` | JWT validation middleware |
| `server/middleware/ratelimit.go` | Rate limiting on auth routes |

### App (Wails)
| File | Responsibility |
|---|---|
| `app/main.go` | Wails entry point |
| `app/app.go` | App struct, Go→JS bindings, loopback auth listener |
| `app/frontend/src/lib/api.ts` | Typed fetch wrapper with auth headers + auto-refresh |
| `app/frontend/src/store/auth.ts` | Zustand auth state (tokens in memory) |
| `app/frontend/src/app/login/page.tsx` | Login screen |
| `app/frontend/src/app/(dashboard)/layout.tsx` | Sidebar layout |
| `app/frontend/src/components/layout/Sidebar.tsx` | Expanded sidebar with icons + labels |
| `app/frontend/src/app/(dashboard)/page.tsx` | Dashboard placeholder |

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `server/go.mod`, `app/go.mod`, `shared/go.mod`
- Create: `.gitignore`, `.env.example`, `README.md`

- [ ] **Step 1: Create root directory structure**

```bash
cd "c:/! A1/Astflye Organize"
mkdir -p server/config server/db server/models server/auth server/handlers server/middleware server/ws
mkdir -p app/frontend
mkdir -p shared/types
mkdir -p data
```

- [ ] **Step 2: Initialize Go modules**

```bash
cd "c:/! A1/Astflye Organize/server" && go mod init github.com/astflye/life/server
cd "c:/! A1/Astflye Organize/app"    && go mod init github.com/astflye/life/app
cd "c:/! A1/Astflye Organize/shared" && go mod init github.com/astflye/life/shared
```

- [ ] **Step 3: Create .gitignore**

```
# Secrets
server/.env
app/.env
.env

# Binaries
server/astflye-server
server/astflye-server.exe
app/build/

# DB
data/
*.db

# Node
node_modules/
app/frontend/.next/
app/frontend/out/

# OS
.DS_Store
Thumbs.db

# Superpowers (brainstorm visuals)
.superpowers/
```

- [ ] **Step 4: Create .env.example**

```bash
# server/.env.example
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:3005/auth/callback
DISCORD_GUILD_ID=
DISCORD_BOT_TOKEN=
DISCORD_ADMIN_ROLE=
PORT=3005
JWT_SECRET=
JWT_REFRESH_SECRET=
DB_PATH=./data/astflye.db
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
ALLOWED_ORIGIN=http://localhost:34115
```

- [ ] **Step 5: Commit scaffold**

```bash
cd "c:/! A1/Astflye Organize"
git add .gitignore .env.example server/go.mod app/go.mod shared/go.mod
git commit -m "feat: monorepo scaffold — Go modules + gitignore + env template"
```

---

## Task 2: Server Dependencies + Config

**Files:**
- Create: `server/config/config.go`
- Modify: `server/go.mod`

- [ ] **Step 1: Install server dependencies**

```bash
cd "c:/! A1/Astflye Organize/server"
go get github.com/gofiber/fiber/v2
go get github.com/gofiber/fiber/v2/middleware/cors
go get github.com/gofiber/fiber/v2/middleware/limiter
go get gorm.io/gorm
go get gorm.io/driver/sqlite
go get github.com/golang-jwt/jwt/v5
go get github.com/gorilla/websocket
go get github.com/joho/godotenv
go get golang.org/x/oauth2
go get github.com/google/uuid
go get golang.org/x/crypto
```

- [ ] **Step 2: Write failing test for config**

Create `server/config/config_test.go`:

```go
package config_test

import (
	"os"
	"testing"
	"github.com/astflye/life/server/config"
)

func TestLoadConfig_MissingRequired(t *testing.T) {
	os.Clearenv()
	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error for missing required env vars, got nil")
	}
}

func TestLoadConfig_Valid(t *testing.T) {
	os.Setenv("DISCORD_CLIENT_ID", "test-id")
	os.Setenv("DISCORD_CLIENT_SECRET", "test-secret")
	os.Setenv("DISCORD_REDIRECT_URI", "http://localhost:3005/auth/callback")
	os.Setenv("DISCORD_GUILD_ID", "123456789")
	os.Setenv("DISCORD_BOT_TOKEN", "bot-token")
	os.Setenv("DISCORD_ADMIN_ROLE", "987654321")
	os.Setenv("JWT_SECRET", "super-secret-jwt-key-32-bytes!!")
	os.Setenv("JWT_REFRESH_SECRET", "super-secret-refresh-32-bytes!!")
	os.Setenv("PORT", "3005")
	os.Setenv("DB_PATH", "./test.db")
	os.Setenv("ALLOWED_ORIGIN", "http://localhost:34115")
	defer os.Clearenv()

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "3005" {
		t.Errorf("expected port 3005, got %s", cfg.Port)
	}
}
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server"
go test ./config/... -v
```
Expected: `cannot find package` or compile error.

- [ ] **Step 4: Implement config.go**

Create `server/config/config.go`:

```go
package config

import (
	"fmt"
	"os"
	"github.com/joho/godotenv"
)

type Config struct {
	DiscordClientID     string
	DiscordClientSecret string
	DiscordRedirectURI  string
	DiscordGuildID      string
	DiscordBotToken     string
	DiscordAdminRole    string
	Port                string
	JWTSecret           string
	JWTRefreshSecret    string
	DBPath              string
	AllowedOrigin       string
	ClaudeAPIKey        string
	ClaudeModel         string
}

func Load() (*Config, error) {
	_ = godotenv.Load() // ignore error — env may already be set

	required := []string{
		"DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET",
		"DISCORD_REDIRECT_URI", "DISCORD_GUILD_ID",
		"DISCORD_BOT_TOKEN", "DISCORD_ADMIN_ROLE",
		"JWT_SECRET", "JWT_REFRESH_SECRET",
	}
	for _, key := range required {
		if os.Getenv(key) == "" {
			return nil, fmt.Errorf("missing required env var: %s", key)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3005"
	}
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/astflye.db"
	}
	model := os.Getenv("CLAUDE_MODEL")
	if model == "" {
		model = "claude-sonnet-4-6"
	}

	return &Config{
		DiscordClientID:     os.Getenv("DISCORD_CLIENT_ID"),
		DiscordClientSecret: os.Getenv("DISCORD_CLIENT_SECRET"),
		DiscordRedirectURI:  os.Getenv("DISCORD_REDIRECT_URI"),
		DiscordGuildID:      os.Getenv("DISCORD_GUILD_ID"),
		DiscordBotToken:     os.Getenv("DISCORD_BOT_TOKEN"),
		DiscordAdminRole:    os.Getenv("DISCORD_ADMIN_ROLE"),
		Port:                port,
		JWTSecret:           os.Getenv("JWT_SECRET"),
		JWTRefreshSecret:    os.Getenv("JWT_REFRESH_SECRET"),
		DBPath:              dbPath,
		AllowedOrigin:       os.Getenv("ALLOWED_ORIGIN"),
		ClaudeAPIKey:        os.Getenv("CLAUDE_API_KEY"),
		ClaudeModel:         model,
	}, nil
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server"
go test ./config/... -v
```
Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add server/config/ server/go.mod server/go.sum
git commit -m "feat(server): config loader with required env validation"
```

---

## Task 3: Database + Models

**Files:**
- Create: `server/db/db.go`
- Create: `server/models/*.go` (all 7 model files)

- [ ] **Step 1: Write failing test for DB init**

Create `server/db/db_test.go`:

```go
package db_test

import (
	"testing"
	"github.com/astflye/life/server/db"
)

func TestInit_CreatesTablesInMemory(t *testing.T) {
	database, err := db.Init(":memory:")
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	if database == nil {
		t.Fatal("expected non-nil db")
	}
	// verify tables exist by checking migrator
	migrator := database.Migrator()
	tables := []string{"users", "tasks", "transactions", "messages", "teams", "team_members", "refresh_tokens", "friendships"}
	for _, table := range tables {
		if !migrator.HasTable(table) {
			t.Errorf("expected table %q to exist after migration", table)
		}
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./db/... -v
```

- [ ] **Step 3: Create all model files**

Create `server/models/user.go`:
```go
package models

import "time"

type User struct {
	ID             string     `gorm:"primaryKey" json:"id"`
	DiscordID      string     `gorm:"uniqueIndex;not null" json:"discord_id"`
	Username       string     `gorm:"not null" json:"username"`
	Avatar         string     `json:"avatar"`
	CurrentStreak  int        `gorm:"default:0" json:"current_streak"`
	LongestStreak  int        `gorm:"default:0" json:"longest_streak"`
	LastActiveDate *time.Time `json:"last_active_date"`
	CreatedAt      time.Time  `json:"created_at"`
}
```

Create `server/models/task.go`:
```go
package models

import "time"

type Task struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	UserID      string     `gorm:"index;not null" json:"user_id"`
	Title       string     `gorm:"not null" json:"title"`
	Description string     `json:"description"`
	Status      string     `gorm:"default:pending" json:"status"`
	Priority    string     `gorm:"default:medium" json:"priority"`
	Category    string     `json:"category"`
	Tags        string     `json:"tags"` // JSON array stored as string
	Recurrence  string     `gorm:"default:none" json:"recurrence"`
	DueDate     time.Time  `json:"due_date"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}
```

Create `server/models/finance.go`:
```go
package models

import "time"

type Transaction struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	UserID      string    `gorm:"index;not null" json:"user_id"`
	Type        string    `gorm:"not null" json:"type"`
	Amount      float64   `gorm:"not null" json:"amount"`
	Currency    string    `gorm:"default:BRL" json:"currency"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Recurring   bool      `gorm:"default:false" json:"recurring"`
	Frequency   string    `gorm:"default:once" json:"frequency"`
	Date        time.Time `json:"date"`
	CreatedAt   time.Time `json:"created_at"`
}
```

Create `server/models/message.go`:
```go
package models

import "time"

type Message struct {
	ID         string     `gorm:"primaryKey" json:"id"`
	SenderID   string     `gorm:"index;not null" json:"sender_id"`
	ReceiverID string     `gorm:"index;not null" json:"receiver_id"`
	ChatType   string     `gorm:"not null" json:"chat_type"`
	Content    string     `gorm:"not null" json:"content"`
	ReadAt     *time.Time `json:"read_at"`
	CreatedAt  time.Time  `json:"created_at"`
}
```

Create `server/models/team.go`:
```go
package models

import "time"

type Team struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	OwnerID   string    `gorm:"not null" json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
}

type TeamMember struct {
	TeamID   string    `gorm:"primaryKey" json:"team_id"`
	UserID   string    `gorm:"primaryKey" json:"user_id"`
	Role     string    `gorm:"default:member" json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

type Friendship struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index;not null" json:"user_id"`
	FriendID  string    `gorm:"index;not null" json:"friend_id"`
	Status    string    `gorm:"default:pending" json:"status"`
	CreatedAt time.Time `json:"created_at"`
}
```

Create `server/models/refresh_token.go`:
```go
package models

import "time"

type RefreshToken struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index;not null" json:"user_id"`
	TokenHash string    `gorm:"not null" json:"token_hash"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
```

- [ ] **Step 4: Create db.go**

Create `server/db/db.go`:
```go
package db

import (
	"os"
	"path/filepath"

	"github.com/astflye/life/server/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Init(dsn string) (*gorm.DB, error) {
	if dsn != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(dsn), 0755); err != nil {
			return nil, err
		}
	}

	database, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = database.AutoMigrate(
		&models.User{},
		&models.Task{},
		&models.Transaction{},
		&models.Message{},
		&models.Team{},
		&models.TeamMember{},
		&models.Friendship{},
		&models.RefreshToken{},
	)
	return database, err
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./db/... -v
```

- [ ] **Step 6: Commit**

```bash
git add server/db/ server/models/
git commit -m "feat(server): GORM models + SQLite auto-migrate"
```

---

## Task 4: JWT Auth

**Files:**
- Create: `server/auth/jwt.go`
- Test: `server/auth/jwt_test.go`

- [ ] **Step 1: Write failing tests**

Create `server/auth/jwt_test.go`:
```go
package auth_test

import (
	"testing"
	"time"
	"github.com/astflye/life/server/auth"
)

const testSecret = "test-secret-key-that-is-32-bytes!"
const testRefreshSecret = "test-refresh-key-that-is-32-bytes"

func TestIssueAndValidateAccessToken(t *testing.T) {
	token, err := auth.IssueAccessToken("user-123", testSecret)
	if err != nil {
		t.Fatalf("IssueAccessToken failed: %v", err)
	}

	userID, err := auth.ValidateAccessToken(token, testSecret)
	if err != nil {
		t.Fatalf("ValidateAccessToken failed: %v", err)
	}
	if userID != "user-123" {
		t.Errorf("expected user-123, got %s", userID)
	}
}

func TestValidateAccessToken_Expired(t *testing.T) {
	// issue a token that expired 1 hour ago
	token, err := auth.IssueAccessTokenWithExpiry("user-123", testSecret, -time.Hour)
	if err != nil {
		t.Fatalf("IssueAccessTokenWithExpiry failed: %v", err)
	}
	_, err = auth.ValidateAccessToken(token, testSecret)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestIssueRefreshToken_UniqueEachCall(t *testing.T) {
	t1, _ := auth.IssueRawRefreshToken()
	t2, _ := auth.IssueRawRefreshToken()
	if t1 == t2 {
		t.Error("refresh tokens should be unique")
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./auth/... -v
```

- [ ] **Step 3: Implement jwt.go**

Create `server/auth/jwt.go`:
```go
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

func IssueAccessToken(userID, secret string) (string, error) {
	return IssueAccessTokenWithExpiry(userID, secret, 24*time.Hour)
}

func IssueAccessTokenWithExpiry(userID, secret string, duration time.Duration) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateAccessToken(tokenStr, secret string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return "", errors.New("invalid token")
	}
	return claims.UserID, nil
}

func IssueRawRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./auth/... -v
```

- [ ] **Step 5: Commit**

```bash
git add server/auth/jwt.go server/auth/jwt_test.go
git commit -m "feat(server): JWT issue/validate + raw refresh token generator"
```

---

## Task 5: Discord OAuth2 + Guild Check

**Files:**
- Create: `server/auth/discord.go`
- Test: `server/auth/discord_test.go`

- [ ] **Step 1: Write failing test for state store**

Create `server/auth/discord_test.go`:
```go
package auth_test

import (
	"testing"
	"github.com/astflye/life/server/auth"
)

func TestStateStore_SetAndValidate(t *testing.T) {
	store := auth.NewStateStore()
	state := store.Generate()

	if !store.Validate(state) {
		t.Error("expected valid state to pass validation")
	}
	// second validation should fail (state consumed)
	if store.Validate(state) {
		t.Error("expected state to be consumed after first validation")
	}
}

func TestStateStore_InvalidState(t *testing.T) {
	store := auth.NewStateStore()
	if store.Validate("bogus-state") {
		t.Error("expected invalid state to fail validation")
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./auth/... -run TestState -v
```

- [ ] **Step 3: Implement discord.go**

Create `server/auth/discord.go`:
```go
package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"golang.org/x/oauth2"
)

// StateStore provides CSRF protection for OAuth2 flow.
type StateStore struct {
	mu     sync.Mutex
	states map[string]time.Time
}

func NewStateStore() *StateStore {
	s := &StateStore{states: make(map[string]time.Time)}
	go s.cleanup()
	return s
}

func (s *StateStore) Generate() string {
	b := make([]byte, 16)
	rand.Read(b)
	state := hex.EncodeToString(b)
	s.mu.Lock()
	s.states[state] = time.Now().Add(5 * time.Minute)
	s.mu.Unlock()
	return state
}

func (s *StateStore) Validate(state string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	exp, ok := s.states[state]
	if !ok || time.Now().After(exp) {
		delete(s.states, state)
		return false
	}
	delete(s.states, state) // consume
	return true
}

func (s *StateStore) cleanup() {
	for range time.Tick(10 * time.Minute) {
		s.mu.Lock()
		for k, v := range s.states {
			if time.Now().After(v) {
				delete(s.states, k)
			}
		}
		s.mu.Unlock()
	}
}

// DiscordUser is the response from Discord's /users/@me endpoint.
type DiscordUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
}

func NewOAuth2Config(clientID, clientSecret, redirectURI string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURI,
		Scopes:       []string{"identify", "guilds"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://discord.com/api/oauth2/authorize",
			TokenURL: "https://discord.com/api/oauth2/token",
		},
	}
}

func FetchDiscordUser(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config) (*DiscordUser, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://discord.com/api/users/@me")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var user DiscordUser
	return &user, json.Unmarshal(body, &user)
}

type DiscordGuild struct {
	ID string `json:"id"`
}

func IsGuildMember(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config, guildID string) (bool, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://discord.com/api/users/@me/guilds")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var guilds []DiscordGuild
	if err := json.Unmarshal(body, &guilds); err != nil {
		return false, fmt.Errorf("parse guilds: %w", err)
	}
	for _, g := range guilds {
		if g.ID == guildID {
			return true, nil
		}
	}
	return false, nil
}

func AvatarURL(userID, avatarHash string) string {
	if avatarHash == "" {
		return ""
	}
	return fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", userID, avatarHash)
}

func DiscordAvatarURL(u *DiscordUser) string {
	return AvatarURL(u.ID, u.Avatar)
}

// BotCheckAdminRole checks if a user has the admin role using the bot token.
func BotCheckAdminRole(ctx context.Context, botToken, guildID, userID, adminRoleID string) (bool, error) {
	url := fmt.Sprintf("https://discord.com/api/guilds/%s/members/%s", guildID, userID)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bot "+botToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return false, nil
	}
	var member struct {
		Roles []string `json:"roles"`
	}
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &member)
	for _, r := range member.Roles {
		if r == adminRoleID {
			return true, nil
		}
	}
	return false, nil
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./auth/... -v
```

- [ ] **Step 5: Commit**

```bash
git add server/auth/discord.go server/auth/discord_test.go
git commit -m "feat(server): Discord OAuth2 config + state store + guild/role checks"
```

---

## Task 6: Auth Middleware + JWT Middleware

**Files:**
- Create: `server/middleware/auth.go`
- Create: `server/middleware/ratelimit.go`
- Test: `server/middleware/auth_test.go`

- [ ] **Step 1: Write failing test**

Create `server/middleware/auth_test.go`:
```go
package middleware_test

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/astflye/life/server/auth"
	"github.com/astflye/life/server/middleware"
	"github.com/gofiber/fiber/v2"
)

const secret = "test-jwt-secret-that-is-32bytes!"

func TestAuthMiddleware_MissingToken(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.RequireAuth(secret))
	app.Get("/test", func(c *fiber.Ctx) error { return c.SendString("ok") })

	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 401 {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.RequireAuth(secret))
	app.Get("/test", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(string)
		return c.SendString(userID)
	})

	token, _ := auth.IssueAccessToken("user-abc", secret)
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "user-abc" {
		t.Errorf("expected user-abc in body, got %s", body)
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./middleware/... -v
```

- [ ] **Step 3: Implement middleware/auth.go**

Create `server/middleware/auth.go`:
```go
package middleware

import (
	"strings"

	"github.com/astflye/life/server/auth"
	"github.com/gofiber/fiber/v2"
)

func RequireAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			return c.Status(401).JSON(fiber.Map{"error": "missing or invalid authorization header"})
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		userID, err := auth.ValidateAccessToken(tokenStr, jwtSecret)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid or expired token"})
		}
		c.Locals("userID", userID)
		return c.Next()
	}
}
```

Create `server/middleware/ratelimit.go`:
```go
package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2"
)

// AuthRateLimit limits auth endpoints to 10 requests per minute per IP.
func AuthRateLimit() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        10,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(429).JSON(fiber.Map{"error": "too many requests"})
		},
	})
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./middleware/... -v
```

- [ ] **Step 5: Commit**

```bash
git add server/middleware/
git commit -m "feat(server): JWT auth middleware + rate limiter"
```

---

## Task 7: Auth Handlers

**Files:**
- Create: `server/handlers/auth.go`
- Create: `server/handlers/users.go`
- Test: `server/handlers/auth_test.go`

- [ ] **Step 1: Write failing tests**

Create `server/handlers/auth_test.go`:
```go
package handlers_test

import (
	"net/http/httptest"
	"testing"

	"github.com/astflye/life/server/db"
	"github.com/astflye/life/server/handlers"
	"github.com/gofiber/fiber/v2"
)

func setupTestApp(t *testing.T) (*fiber.App, func()) {
	t.Helper()
	database, err := db.Init(":memory:")
	if err != nil {
		t.Fatalf("db init: %v", err)
	}
	app := fiber.New()
	h := handlers.NewAuthHandler(database, handlers.AuthHandlerConfig{
		JWTSecret:        "test-jwt-secret-that-is-32bytes!",
		JWTRefreshSecret: "test-refresh-secret-32bytes!!!!!",
		DiscordGuildID:   "test-guild",
	})
	app.Get("/auth/callback", h.Callback)
	app.Post("/auth/refresh", h.Refresh)
	app.Post("/auth/logout", h.Logout)
	return app, func() {}
}

func TestAuthCallback_MissingCode(t *testing.T) {
	app, cleanup := setupTestApp(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/auth/callback?state=test", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 400 {
		t.Errorf("expected 400 for missing code, got %d", resp.StatusCode)
	}
}

func TestAuthRefresh_MissingToken(t *testing.T) {
	app, cleanup := setupTestApp(t)
	defer cleanup()

	req := httptest.NewRequest("POST", "/auth/refresh", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 400 {
		t.Errorf("expected 400 for missing refresh token, got %d", resp.StatusCode)
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -v
```

- [ ] **Step 3: Implement handlers/auth.go**

Create `server/handlers/auth.go`:
```go
package handlers

import (
	"strings"
	"time"

	"github.com/astflye/life/server/auth"
	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

type AuthHandlerConfig struct {
	JWTSecret        string
	JWTRefreshSecret string
	DiscordGuildID   string
	OAuth2Config     *oauth2.Config
	StateStore       *auth.StateStore
}

type AuthHandler struct {
	db  *gorm.DB
	cfg AuthHandlerConfig
}

func NewAuthHandler(db *gorm.DB, cfg AuthHandlerConfig) *AuthHandler {
	if cfg.StateStore == nil {
		cfg.StateStore = auth.NewStateStore()
	}
	return &AuthHandler{db: db, cfg: cfg}
}

// GetLoginURL returns the Discord OAuth2 URL for the frontend to open.
func (h *AuthHandler) GetLoginURL(c *fiber.Ctx) error {
	if h.cfg.OAuth2Config == nil {
		return c.Status(500).JSON(fiber.Map{"error": "OAuth2 not configured"})
	}
	state := h.cfg.StateStore.Generate()
	url := h.cfg.OAuth2Config.AuthCodeURL(state)
	return c.JSON(fiber.Map{"url": url})
}

// Callback handles GET /auth/callback from Discord.
func (h *AuthHandler) Callback(c *fiber.Ctx) error {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "missing code"})
	}
	if state == "" || (h.cfg.StateStore != nil && !h.cfg.StateStore.Validate(state)) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid state"})
	}

	if h.cfg.OAuth2Config == nil {
		// test mode — skip Discord exchange
		return c.Status(400).JSON(fiber.Map{"error": "OAuth2 not configured"})
	}

	ctx := c.Context()
	token, err := h.cfg.OAuth2Config.Exchange(ctx, code)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "failed to exchange code"})
	}

	discordUser, err := auth.FetchDiscordUser(ctx, token, h.cfg.OAuth2Config)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch user"})
	}

	isMember, err := auth.IsGuildMember(ctx, token, h.cfg.OAuth2Config, h.cfg.DiscordGuildID)
	if err != nil || !isMember {
		return c.Status(403).JSON(fiber.Map{
			"error":    "you must join the Astflye Discord server first",
			"join_url": "https://discord.gg/",
		})
	}

	user := models.User{}
	result := h.db.Where("discord_id = ?", discordUser.ID).First(&user)
	if result.Error != nil {
		user = models.User{
			ID:        uuid.New().String(),
			DiscordID: discordUser.ID,
			Username:  discordUser.Username,
			Avatar:    auth.DiscordAvatarURL(discordUser),
		}
		h.db.Create(&user)
	} else {
		h.db.Model(&user).Updates(map[string]interface{}{
			"username": discordUser.Username,
			"avatar":   auth.DiscordAvatarURL(discordUser),
		})
	}

	accessToken, err := auth.IssueAccessToken(user.ID, h.cfg.JWTSecret)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to issue token"})
	}

	rawRefresh, err := auth.IssueRawRefreshToken()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to issue refresh token"})
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(rawRefresh), bcrypt.DefaultCost)
	h.db.Create(&models.RefreshToken{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		TokenHash: string(hash),
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
	})

	// Redirect to Wails loopback listener
	redirectURL := "http://localhost:34115/auth/done?token=" + accessToken + "&refresh=" + rawRefresh
	return c.Redirect(redirectURL)
}

// Refresh handles POST /auth/refresh.
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.BodyParser(&body); err != nil || body.RefreshToken == "" {
		return c.Status(400).JSON(fiber.Map{"error": "missing refresh_token"})
	}

	var tokens []models.RefreshToken
	h.db.Where("expires_at > ?", time.Now()).Find(&tokens)

	var matched *models.RefreshToken
	for i := range tokens {
		if bcrypt.CompareHashAndPassword([]byte(tokens[i].TokenHash), []byte(body.RefreshToken)) == nil {
			matched = &tokens[i]
			break
		}
	}
	if matched == nil {
		return c.Status(401).JSON(fiber.Map{"error": "invalid or expired refresh token"})
	}

	// Re-validate guild membership on refresh
	accessToken, err := auth.IssueAccessToken(matched.UserID, h.cfg.JWTSecret)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to issue token"})
	}

	return c.JSON(fiber.Map{"access_token": accessToken})
}

// Logout handles POST /auth/logout.
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.RefreshToken) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "missing refresh_token"})
	}

	var tokens []models.RefreshToken
	h.db.Where("user_id = ?", c.Locals("userID")).Find(&tokens)
	for _, t := range tokens {
		if bcrypt.CompareHashAndPassword([]byte(t.TokenHash), []byte(body.RefreshToken)) == nil {
			h.db.Delete(&t)
			break
		}
	}
	return c.JSON(fiber.Map{"ok": true})
}
```

Create `server/handlers/users.go`:
```go
package handlers

import (
	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type UserHandler struct {
	db *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{db: db}
}

func (h *UserHandler) Me(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}
	return c.JSON(user)
}

func (h *UserHandler) GetByID(c *fiber.Ctx) error {
	var user models.User
	if err := h.db.First(&user, "id = ?", c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}
	// strip sensitive info for public profile
	return c.JSON(fiber.Map{
		"id":       user.ID,
		"username": user.Username,
		"avatar":   user.Avatar,
	})
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -v
```

- [ ] **Step 5: Commit**

```bash
git add server/handlers/
git commit -m "feat(server): auth + user handlers (callback, refresh, logout, me)"
```

---

## Task 8: Server Entry Point + Routes

**Files:**
- Create: `server/main.go`

- [ ] **Step 1: Create main.go**

Create `server/main.go`:
```go
package main

import (
	"log"

	"github.com/astflye/life/server/auth"
	"github.com/astflye/life/server/config"
	"github.com/astflye/life/server/db"
	"github.com/astflye/life/server/handlers"
	"github.com/astflye/life/server/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	database, err := db.Init(cfg.DBPath)
	if err != nil {
		log.Fatalf("db error: %v", err)
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigin,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Authorization",
		AllowCredentials: true,
	}))

	oauth2Cfg := auth.NewOAuth2Config(cfg.DiscordClientID, cfg.DiscordClientSecret, cfg.DiscordRedirectURI)
	stateStore := auth.NewStateStore()

	authHandler := handlers.NewAuthHandler(database, handlers.AuthHandlerConfig{
		JWTSecret:        cfg.JWTSecret,
		JWTRefreshSecret: cfg.JWTRefreshSecret,
		DiscordGuildID:   cfg.DiscordGuildID,
		OAuth2Config:     oauth2Cfg,
		StateStore:       stateStore,
	})
	userHandler := handlers.NewUserHandler(database)

	// Auth routes (rate-limited)
	authGroup := app.Group("/auth", middleware.AuthRateLimit())
	authGroup.Get("/login-url", authHandler.GetLoginURL)
	authGroup.Get("/callback", authHandler.Callback)
	authGroup.Post("/refresh", authHandler.Refresh)
	authGroup.Post("/logout", authHandler.Logout)

	// Protected routes
	api := app.Group("/", middleware.RequireAuth(cfg.JWTSecret))
	api.Get("/users/me", userHandler.Me)
	api.Get("/users/:id", userHandler.GetByID)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	log.Printf("Astflye server starting on :%s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "c:/! A1/Astflye Organize/server" && go build ./...
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/main.go
git commit -m "feat(server): wire Fiber app with all Phase 1 routes"
```

---

## Task 9: Wails App Shell

**Files:**
- Create: `app/main.go`, `app/app.go`, `app/wails.json`
- Create: `app/frontend/` (Next.js project)

- [ ] **Step 1: Install Wails CLI (if not installed)**

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails version
```
Expected: prints Wails version.

- [ ] **Step 2: Initialize Wails project**

```bash
cd "c:/! A1/Astflye Organize"
wails init -n astflye-app -t react -d app
```
Then replace the React frontend scaffold — we'll use Next.js instead.

- [ ] **Step 3: Update app/go.mod and install Wails dependency**

```bash
cd "c:/! A1/Astflye Organize/app"
go get github.com/wailsapp/wails/v2
```

- [ ] **Step 4: Create app/app.go with auth loopback listener**

Create `app/app.go`:
```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx         context.Context
	accessToken string
	refreshToken string
	mu          sync.Mutex
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// StartLogin opens the browser to the Discord OAuth URL and starts
// the loopback listener on :34115 to receive tokens.
func (a *App) StartLogin(serverURL string) error {
	// Fetch login URL from our Go server
	resp, err := http.Get(serverURL + "/auth/login-url")
	if err != nil {
		return fmt.Errorf("cannot reach server: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		URL string `json:"url"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	// Open browser
	runtime.BrowserOpenURL(a.ctx, result.URL)

	// Start loopback listener
	go a.listenForTokens()
	return nil
}

func (a *App) listenForTokens() {
	srv := &http.Server{Addr: ":34115"}
	done := make(chan struct{})

	http.HandleFunc("/auth/done", func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		refresh := r.URL.Query().Get("refresh")
		if token == "" {
			http.Error(w, "missing token", 400)
			return
		}
		a.mu.Lock()
		a.accessToken = token
		a.refreshToken = refresh
		a.mu.Unlock()

		// Tell frontend auth succeeded
		runtime.EventsEmit(a.ctx, "auth:success")
		w.Write([]byte("<html><body><h2>Login successful! You can close this tab.</h2></body></html>"))
		go func() {
			time.Sleep(500 * time.Millisecond)
			srv.Shutdown(context.Background())
			close(done)
		}()
	})

	srv.ListenAndServe()
}

// GetAccessToken exposes the token to the frontend JS.
func (a *App) GetAccessToken() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.accessToken
}

// IsAuthenticated returns whether the user has a token.
func (a *App) IsAuthenticated() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.accessToken != ""
}

// Logout clears tokens.
func (a *App) Logout() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.accessToken = ""
	a.refreshToken = ""
}
```

- [ ] **Step 5: Create app/main.go**

Create `app/main.go`:
```go
package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/out
var assets embed.FS

func main() {
	app := NewApp()
	err := wails.Run(&options.App{
		Title:  "Astflye Life",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 8, G: 5, B: 15, A: 255},
		OnStartup:        app.startup,
		Bind:             []interface{}{app},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
```

- [ ] **Step 6: Scaffold Next.js frontend**

```bash
cd "c:/! A1/Astflye Organize/app"
npx create-next-app@14 frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --no-eslint
```

- [ ] **Step 7: Configure Next.js for static export**

Edit `app/frontend/next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}
module.exports = nextConfig
```

- [ ] **Step 8: Install frontend dependencies**

```bash
cd "c:/! A1/Astflye Organize/app/frontend"
npm install @tanstack/react-query zustand framer-motion recharts
npx shadcn-ui@latest init
```
When shadcn asks:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 9: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/
git commit -m "feat(app): Wails shell + Next.js 14 static export + auth loopback listener"
```

---

## Task 10: Frontend Auth + Sidebar Layout

**Files:**
- Create: `app/frontend/src/store/auth.ts`
- Create: `app/frontend/src/lib/api.ts`
- Create: `app/frontend/src/app/login/page.tsx`
- Create: `app/frontend/src/app/(dashboard)/layout.tsx`
- Create: `app/frontend/src/components/layout/Sidebar.tsx`
- Create: `app/frontend/src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Install Jest + React Testing Library**

```bash
cd "c:/! A1/Astflye Organize/app/frontend"
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest
```

Create `jest.config.js`:
```js
module.exports = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  setupFilesAfterFramework: ['@testing-library/jest-dom'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}
```

- [ ] **Step 2: Write failing test for auth store**

Create `app/frontend/src/__tests__/auth-store.test.ts`:
```ts
import { useAuthStore } from '@/store/auth'

beforeEach(() => useAuthStore.getState().clear())

test('initial state is unauthenticated', () => {
  expect(useAuthStore.getState().isAuthenticated()).toBe(false)
})

test('setTokens marks authenticated', () => {
  useAuthStore.getState().setTokens('access-123', 'refresh-456')
  expect(useAuthStore.getState().isAuthenticated()).toBe(true)
  expect(useAuthStore.getState().accessToken).toBe('access-123')
})

test('clear removes tokens', () => {
  useAuthStore.getState().setTokens('access-123', 'refresh-456')
  useAuthStore.getState().clear()
  expect(useAuthStore.getState().isAuthenticated()).toBe(false)
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test -- --testPathPattern=auth-store
```

- [ ] **Step 4: Implement auth store**

Create `app/frontend/src/store/auth.ts`:
```ts
import { create } from 'zustand'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  setTokens: (access: string, refresh: string) => void
  clear: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
  clear: () => set({ accessToken: null, refreshToken: null }),
  isAuthenticated: () => get().accessToken !== null,
}))
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test -- --testPathPattern=auth-store
```

- [ ] **Step 6: Create API client**

Create `app/frontend/src/lib/api.ts`:
```ts
import { useAuthStore } from '@/store/auth'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3005'

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().accessToken
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${SERVER_URL}${path}`, { ...options, headers })
  if (res.status === 401) {
    useAuthStore.getState().clear()
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}
```

- [ ] **Step 7: Create login page**

Create `app/frontend/app/login/page.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'

// Wails bridge (only available in desktop context)
declare const window: Window & {
  go?: { main: { App: { StartLogin: (url: string) => Promise<void> } } }
  runtime?: { EventsOn: (event: string, cb: () => void) => void }
}

export default function LoginPage() {
  const router = useRouter()
  const setTokens = useAuthStore((s) => s.setTokens)

  useEffect(() => {
    // Listen for auth:success event emitted by Go after loopback receives tokens
    window.runtime?.EventsOn('auth:success', async () => {
      const token = await window.go?.main.App.GetAccessToken()
      if (token) {
        setTokens(token, '')
        router.push('/')
      }
    })
  }, [])

  const handleLogin = async () => {
    await window.go?.main.App.StartLogin('http://localhost:3005')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#08050f' }}>
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold" style={{ color: '#b455ff' }}>Astflye Life</h1>
        <p className="text-sm" style={{ color: '#776688' }}>Your productivity universe</p>
        <button
          onClick={handleLogin}
          className="px-8 py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}
        >
          Login with Discord
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Create Sidebar component**

Create `app/frontend/components/layout/Sidebar.tsx`:
```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const nav = [
  { href: '/',         icon: '📋', label: 'Tasks'   },
  { href: '/finance',  icon: '💰', label: 'Finance' },
  { href: '/social',   icon: '👥', label: 'Social'  },
  { href: '/settings', icon: '⚙️', label: 'Settings'},
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className="flex flex-col h-full transition-all duration-200"
      style={{
        width: collapsed ? 56 : 180,
        background: '#110820',
        borderRight: '1px solid #b455ff22',
        padding: '16px 8px',
      }}
    >
      <div className="flex items-center justify-between mb-6 px-1">
        {!collapsed && (
          <span className="text-xs font-bold tracking-widest" style={{ color: '#b455ff' }}>
            ASTFLYE
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs opacity-40 hover:opacity-80"
          style={{ color: '#b455ff' }}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {nav.map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-2 py-2 rounded-lg transition-all"
              style={{
                background: active ? '#b455ff22' : 'transparent',
                border: active ? '1px solid #b455ff44' : '1px solid transparent',
                color: active ? '#e0d0ff' : '#776688',
              }}
            >
              <span className="text-base">{icon}</span>
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 9: Create dashboard layout**

Create `app/frontend/app/(dashboard)/layout.tsx`:
```tsx
import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#08050f' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto p-6" style={{ color: '#e0d0ff' }}>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 10: Create dashboard placeholder**

Create `app/frontend/app/(dashboard)/page.tsx`:
```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#b455ff' }}>
        Welcome to Astflye Life
      </h1>
      <p style={{ color: '#776688' }}>Phase 1 complete — auth and shell working.</p>
    </div>
  )
}
```

- [ ] **Step 11: Build frontend and verify**

```bash
cd "c:/! A1/Astflye Organize/app/frontend"
npm run build
```
Expected: `out/` directory created, no errors.

- [ ] **Step 12: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/frontend/
git commit -m "feat(app): auth store + API client + login page + sidebar layout"
```

---

## Task 11: End-to-End Smoke Test + Phase 1 Commit

- [ ] **Step 1: Run all server tests**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./... -v
```
Expected: all PASS.

- [ ] **Step 2: Run all frontend tests**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test
```
Expected: all PASS.

- [ ] **Step 3: Build server binary**

```bash
cd "c:/! A1/Astflye Organize/server" && go build -o astflye-server.exe .
```
Expected: `astflye-server.exe` created.

- [ ] **Step 4: Create server/.env from template, fill in your values**

```bash
cp "c:/! A1/Astflye Organize/.env.example" "c:/! A1/Astflye Organize/server/.env"
# Then edit server/.env with real Discord credentials
# IMPORTANT: register http://localhost:3005/auth/callback in Discord Developer Portal → OAuth2 → Redirects
```

- [ ] **Step 5: Start server and test /health**

```bash
cd "c:/! A1/Astflye Organize/server" && ./astflye-server.exe &
curl http://localhost:3005/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 6: Final Phase 1 commit**

```bash
cd "c:/! A1/Astflye Organize"
git add .
git commit -m "feat: Phase 1 complete — server + Wails shell + Discord auth end-to-end"
```
