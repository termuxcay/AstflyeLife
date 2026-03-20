# Discord Login + Local JSON Storage Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate Fiber/SQLite server binary with logic embedded directly in the Wails desktop app, using Discord OAuth2 (fresh login every launch) and local JSON files for data persistence.

**Architecture:** A minimal `net/http` server runs on port 3005 inside the Wails process to handle the Discord OAuth callback. A dynamic loopback captures the token after auth. All data (tasks, finance) is stored as JSON arrays in `%AppData%\Astflye\`. The frontend uses the Wails bridge (`window.go.main.App.*`) exclusively — no HTTP fetch calls.

**Tech Stack:** Go 1.26, Wails v2, `golang.org/x/oauth2`, `github.com/golang-jwt/jwt/v5`, `github.com/joho/godotenv`, React 18, Zustand, TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-20-discord-login-local-rewrite-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/config.go` | CREATE | Load config from `%AppData%\Astflye\.env` |
| `app/auth.go` | CREATE | Discord OAuth helpers, JWT, StateStore, embedded OAuth HTTP server |
| `app/data.go` | CREATE | JSON file CRUD for tasks and finance |
| `app/app.go` | REWRITE | App struct, StartLogin, loopback, user getters, bridge wrappers for data |
| `app/main.go` | REWRITE | Load config, create App, start Wails |
| `app/config_test.go` | CREATE | Tests for config loading |
| `app/auth_test.go` | CREATE | Tests for JWT and StateStore |
| `app/data_test.go` | CREATE | Tests for JSON CRUD |
| `app/frontend/wailsjs/go/main/App.d.ts` | REWRITE | Updated bridge TypeScript declarations |
| `app/frontend/wailsjs/go/main/App.js` | REWRITE | Updated bridge JS bindings |
| `app/frontend/src/store/auth.ts` | MODIFY | Remove refreshToken, add discordId |
| `app/frontend/src/lib/api.ts` | REWRITE | Thin Wails bridge wrappers (no fetch) |
| `app/frontend/src/hooks/useTasks.ts` | REWRITE | Use bridge via api.ts |
| `app/frontend/src/hooks/useFinance.ts` | REWRITE | Use bridge via api.ts |
| `app/frontend/src/hooks/useMe.ts` | REWRITE | Pure Zustand selector |
| `app/frontend/src/hooks/useSocial.ts` | DELETE | Removed with social feature |
| `app/frontend/src/pages/AuthDonePage.tsx` | DELETE | Dead code after rewrite |
| `app/frontend/src/pages/SocialPage.tsx` | REWRITE | "Em breve" stub |
| `app/frontend/src/pages/LoginPage.tsx` | MODIFY | Remove browser fallback, no-arg StartLogin |
| `app/frontend/src/pages/ProfilePage.tsx` | MODIFY | Logout via bridge |
| `app/frontend/src/main.tsx` | MODIFY | Remove /auth/done route |
| `app/frontend/vite.config.ts` | MODIFY | Remove proxy |
| `server/` | DELETE | Entire directory removed |

---

## Task 1: Add Go dependencies to app/

**Files:** `app/go.mod`, `app/go.sum`

- [ ] **Step 1: Add required packages**

```bash
cd "c:/! A1/Astflye Organize/app"
go get golang.org/x/oauth2@latest
go get github.com/golang-jwt/jwt/v5@latest
go get github.com/joho/godotenv@latest
```

- [ ] **Step 2: Verify go.mod has the three new entries**

```bash
grep -E "oauth2|golang-jwt|godotenv" go.mod
```

Expected output (versions may differ):
```
github.com/golang-jwt/jwt/v5 v5.x.x
github.com/joho/godotenv v1.x.x
golang.org/x/oauth2 v0.x.x
```

- [ ] **Step 3: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/go.mod app/go.sum
git commit -m "chore(app): add oauth2, jwt, godotenv dependencies"
```

---

## Task 2: Create app/config.go

**Files:** `app/config.go`, `app/config_test.go`

- [ ] **Step 1: Write failing test**

Create `app/config_test.go`:

```go
package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig_MissingRequired(t *testing.T) {
	// Unset all Discord env vars
	for _, k := range []string{"DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID", "DISCORD_REDIRECT_URI"} {
		os.Unsetenv(k)
	}
	_, err := loadConfig()
	if err == nil {
		t.Fatal("expected error for missing required vars, got nil")
	}
}

func TestLoadConfig_Valid(t *testing.T) {
	t.Setenv("DISCORD_CLIENT_ID", "test_id")
	t.Setenv("DISCORD_CLIENT_SECRET", "test_secret")
	t.Setenv("DISCORD_GUILD_ID", "test_guild")
	t.Setenv("DISCORD_REDIRECT_URI", "http://localhost:3005/auth/callback")
	t.Setenv("JWT_SECRET", "my_secret")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.DiscordClientID != "test_id" {
		t.Errorf("ClientID = %q, want %q", cfg.DiscordClientID, "test_id")
	}
	if cfg.JWTSecret == "" {
		t.Error("JWTSecret should not be empty")
	}
}

func TestDataDir(t *testing.T) {
	dir, err := dataDir()
	if err != nil {
		t.Fatalf("dataDir() error: %v", err)
	}
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Errorf("dataDir() returned non-existent path: %s", dir)
	}
	_ = filepath.Join(dir) // just check it's a valid path
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "c:/! A1/Astflye Organize/app"
go test -run "TestLoadConfig|TestDataDir" -v
```

Expected: FAIL — `loadConfig` and `dataDir` undefined

- [ ] **Step 3: Create app/config.go**

```go
package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

type Config struct {
	DiscordClientID     string
	DiscordClientSecret string
	DiscordGuildID      string
	DiscordRedirectURI  string
	JWTSecret           string
}

// loadConfig loads config from %AppData%/Astflye/.env and environment variables.
// Environment variables take precedence over the .env file.
func loadConfig() (*Config, error) {
	// Try to load from AppData .env (ignore error — may not exist yet)
	if dir, err := os.UserConfigDir(); err == nil {
		_ = godotenv.Load(filepath.Join(dir, "Astflye", ".env"))
	}
	// Also try local .env for development
	_ = godotenv.Load()

	required := map[string]*string{
		"DISCORD_CLIENT_ID":     nil,
		"DISCORD_CLIENT_SECRET": nil,
		"DISCORD_GUILD_ID":      nil,
		"DISCORD_REDIRECT_URI":  nil,
	}
	for k := range required {
		v := os.Getenv(k)
		if v == "" {
			return nil, fmt.Errorf("missing required env var: %s", k)
		}
		required[k] = &v
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Auto-generate a random secret for this session
		b := make([]byte, 32)
		rand.Read(b)
		secret = hex.EncodeToString(b)
	}

	return &Config{
		DiscordClientID:     *required["DISCORD_CLIENT_ID"],
		DiscordClientSecret: *required["DISCORD_CLIENT_SECRET"],
		DiscordGuildID:      *required["DISCORD_GUILD_ID"],
		DiscordRedirectURI:  *required["DISCORD_REDIRECT_URI"],
		JWTSecret:           secret,
	}, nil
}

// dataDir returns (and creates if needed) the app's data directory.
func dataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("userConfigDir: %w", err)
	}
	dir := filepath.Join(base, "Astflye")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("mkdirAll %s: %w", dir, err)
	}
	return dir, nil
}
```

- [ ] **Step 4: Run tests**

```bash
cd "c:/! A1/Astflye Organize/app"
go test -run "TestLoadConfig|TestDataDir" -v
```

Expected: PASS all 3 tests

- [ ] **Step 5: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/config.go app/config_test.go
git commit -m "feat(app): config.go — load from AppData/.env, auto-gen JWT secret"
```

---

## Task 3: Create app/auth.go

**Files:** `app/auth.go`, `app/auth_test.go`

- [ ] **Step 1: Write failing tests**

Create `app/auth_test.go`:

```go
package main

import (
	"testing"
	"time"
)

// --- JWT tests ---

func TestIssueAndValidateJWT(t *testing.T) {
	secret := "test_secret_32_chars_long_enough!"
	discordID := "123456789012345678"

	token, err := issueJWT(discordID, secret, 1*time.Hour)
	if err != nil {
		t.Fatalf("issueJWT error: %v", err)
	}
	if token == "" {
		t.Fatal("token is empty")
	}

	got, err := validateJWT(token, secret)
	if err != nil {
		t.Fatalf("validateJWT error: %v", err)
	}
	if got != discordID {
		t.Errorf("discordID = %q, want %q", got, discordID)
	}
}

func TestValidateJWT_Expired(t *testing.T) {
	secret := "test_secret_32_chars_long_enough!"
	token, _ := issueJWT("123", secret, -1*time.Second) // already expired
	_, err := validateJWT(token, secret)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestValidateJWT_WrongSecret(t *testing.T) {
	token, _ := issueJWT("123", "secret_a", 1*time.Hour)
	_, err := validateJWT(token, "secret_b")
	if err == nil {
		t.Fatal("expected error for wrong secret, got nil")
	}
}

// --- StateStore tests ---

func TestStateStore_GenerateAndConsume(t *testing.T) {
	s := newStateStore()
	doneURL := "http://127.0.0.1:54321/auth/done"
	state := s.Generate(doneURL)
	if state == "" {
		t.Fatal("state is empty")
	}
	got, ok := s.Consume(state)
	if !ok {
		t.Fatal("Consume returned ok=false")
	}
	if got != doneURL {
		t.Errorf("doneURL = %q, want %q", got, doneURL)
	}
}

func TestStateStore_ConsumeOnce(t *testing.T) {
	s := newStateStore()
	state := s.Generate("http://example.com")
	s.Consume(state) // first consume
	_, ok := s.Consume(state) // second should fail
	if ok {
		t.Fatal("expected second Consume to fail (single-use)")
	}
}

func TestStateStore_InvalidState(t *testing.T) {
	s := newStateStore()
	_, ok := s.Consume("nonexistent_state")
	if ok {
		t.Fatal("expected ok=false for unknown state")
	}
}

// --- AvatarURL tests ---

func TestAvatarURL_WithHash(t *testing.T) {
	url := discordAvatarURL("123", "abc123hash", "0")
	want := "https://cdn.discordapp.com/avatars/123/abc123hash.png"
	if url != want {
		t.Errorf("avatarURL = %q, want %q", url, want)
	}
}

func TestAvatarURL_DefaultNewStyle(t *testing.T) {
	// discriminator "0" = new-style username, uses snowflake mod 6
	url := discordAvatarURL("1234567891234567890", "", "0")
	if url == "" {
		t.Fatal("expected non-empty URL")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/! A1/Astflye Organize/app"
go test -run "TestIssueAndValidate|TestValidateJWT|TestStateStore|TestAvatarURL" -v
```

Expected: FAIL — symbols undefined

- [ ] **Step 3: Create app/auth.go**

```go
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

// ─── StateStore ────────────────────────────────────────────────────────────────

type stateEntry struct {
	expiry  time.Time
	doneURL string
}

type stateStore struct {
	mu     sync.Mutex
	states map[string]stateEntry
}

func newStateStore() *stateStore {
	s := &stateStore{states: make(map[string]stateEntry)}
	go s.cleanup()
	return s
}

// Generate creates a CSRF state token that encodes doneURL inside it.
func (s *stateStore) Generate(doneURL string) string {
	b := make([]byte, 16)
	rand.Read(b)
	state := hex.EncodeToString(b)
	s.mu.Lock()
	s.states[state] = stateEntry{expiry: time.Now().Add(10 * time.Minute), doneURL: doneURL}
	s.mu.Unlock()
	return state
}

// Consume validates and removes the state, returning the stored doneURL.
func (s *stateStore) Consume(state string) (doneURL string, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, exists := s.states[state]
	if !exists || time.Now().After(entry.expiry) {
		delete(s.states, state)
		return "", false
	}
	delete(s.states, state)
	return entry.doneURL, true
}

func (s *stateStore) cleanup() {
	for range time.Tick(5 * time.Minute) {
		s.mu.Lock()
		for k, v := range s.states {
			if time.Now().After(v.expiry) {
				delete(s.states, k)
			}
		}
		s.mu.Unlock()
	}
}

// ─── Discord API ───────────────────────────────────────────────────────────────

type discordUser struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"`
	Avatar        string `json:"avatar"`
	Discriminator string `json:"discriminator"`
}

func fetchDiscordUser(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config) (*discordUser, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://discord.com/api/users/@me")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("discord /users/@me returned %d: %s", resp.StatusCode, body)
	}
	var u discordUser
	if err := json.Unmarshal(body, &u); err != nil {
		return nil, err
	}
	if u.ID == "" || u.Username == "" {
		return nil, errors.New("discord returned incomplete user payload")
	}
	if u.GlobalName == "" {
		u.GlobalName = u.Username
	}
	return &u, nil
}

type discordGuild struct {
	ID string `json:"id"`
}

func isGuildMember(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config, guildID string) (bool, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://discord.com/api/users/@me/guilds")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var guilds []discordGuild
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

func discordAvatarURL(userID, avatarHash, discriminator string) string {
	if avatarHash != "" {
		return fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", userID, avatarHash)
	}
	var index int64
	if discriminator == "0" || discriminator == "" {
		var snowflake int64
		fmt.Sscanf(userID, "%d", &snowflake)
		index = (snowflake >> 22) % 6
	} else {
		var d int64
		fmt.Sscanf(discriminator, "%d", &d)
		index = d % 5
	}
	return fmt.Sprintf("https://cdn.discordapp.com/embed/avatars/%d.png", index)
}

// ─── JWT ───────────────────────────────────────────────────────────────────────

type jwtClaims struct {
	DiscordID string `json:"discord_id"`
	jwt.RegisteredClaims
}

func issueJWT(discordID, secret string, expiry time.Duration) (string, error) {
	claims := jwtClaims{
		DiscordID: discordID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func validateJWT(tokenStr, secret string) (discordID string, err error) {
	token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := token.Claims.(*jwtClaims)
	if !ok || !token.Valid {
		return "", errors.New("invalid token")
	}
	return claims.DiscordID, nil
}

// ─── OAuth2 Config ─────────────────────────────────────────────────────────────

func newOAuth2Config(cfg *Config) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     cfg.DiscordClientID,
		ClientSecret: cfg.DiscordClientSecret,
		RedirectURL:  cfg.DiscordRedirectURI,
		Scopes:       []string{"identify", "guilds"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://discord.com/api/oauth2/authorize",
			TokenURL: "https://discord.com/api/oauth2/token",
		},
	}
}

// ─── Embedded OAuth HTTP server (port 3005) ────────────────────────────────────

// startOAuthServer starts the OAuth callback server. Called from App.startup().
func (a *App) startOAuthServer() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/auth/callback", a.handleOAuthCallback)
	srv := &http.Server{Addr: ":3005", Handler: mux}
	a.oauthSrv = srv
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("OAuth server error: %v\n", err)
		}
	}()
	return nil
}

// handleOAuthCallback handles GET /auth/callback from Discord.
func (a *App) handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		http.Error(w, "missing code or state", 400)
		return
	}

	doneURL, ok := a.ss.Consume(state)
	if !ok {
		http.Error(w, "invalid or expired state", 400)
		return
	}

	token, err := a.oauthCfg.Exchange(r.Context(), code)
	if err != nil {
		http.Redirect(w, r, doneURL+"?error=exchange_failed", http.StatusFound)
		return
	}

	user, err := fetchDiscordUser(r.Context(), token, a.oauthCfg)
	if err != nil {
		http.Redirect(w, r, doneURL+"?error=discord_error", http.StatusFound)
		return
	}

	member, err := isGuildMember(r.Context(), token, a.oauthCfg, a.cfg.DiscordGuildID)
	if err != nil || !member {
		http.Redirect(w, r, doneURL+"?error=not_member", http.StatusFound)
		return
	}

	jwtToken, err := issueJWT(user.ID, a.cfg.JWTSecret, 8*time.Hour)
	if err != nil {
		http.Redirect(w, r, doneURL+"?error=jwt_failed", http.StatusFound)
		return
	}

	avatarURL := discordAvatarURL(user.ID, user.Avatar, user.Discriminator)

	q := "?token=" + jwtToken +
		"&username=" + user.Username +
		"&global_name=" + user.GlobalName +
		"&avatar=" + avatarURL +
		"&discord_id=" + user.ID

	http.Redirect(w, r, doneURL+q, http.StatusFound)
}
```

- [ ] **Step 4: Run auth tests**

```bash
cd "c:/! A1/Astflye Organize/app"
go test -run "TestIssueAndValidate|TestValidateJWT|TestStateStore|TestAvatarURL" -v
```

Expected: PASS all 8 tests

- [ ] **Step 5: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/auth.go app/auth_test.go
git commit -m "feat(app): auth.go — Discord OAuth helpers, JWT, StateStore, embedded callback server"
```

---

## Task 4: Create app/data.go

**Files:** `app/data.go`, `app/data_test.go`

- [ ] **Step 1: Write failing tests**

Create `app/data_test.go`:

```go
package main

import (
	"os"
	"testing"
)

const testDiscordID = "111222333444555666"

// ─── Task tests ───────────────────────────────────────────────────────────────

func TestTasks_CRUD(t *testing.T) {
	dir := t.TempDir()

	// Initially empty
	tasks, err := getTasks(dir, testDiscordID)
	if err != nil {
		t.Fatalf("getTasks error: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks, got %d", len(tasks))
	}

	// Create
	task, err := createTask(dir, testDiscordID, TaskInput{Title: "Test task", Priority: "medium", Recurrence: "none"})
	if err != nil {
		t.Fatalf("createTask error: %v", err)
	}
	if task.ID == "" {
		t.Error("created task has no ID")
	}
	if task.Status != "pending" {
		t.Errorf("status = %q, want pending", task.Status)
	}

	// Get — should return 1
	tasks, _ = getTasks(dir, testDiscordID)
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}

	// Update status
	if err := updateTaskStatus(dir, testDiscordID, task.ID, "completed"); err != nil {
		t.Fatalf("updateTaskStatus error: %v", err)
	}
	tasks, _ = getTasks(dir, testDiscordID)
	if tasks[0].Status != "completed" {
		t.Errorf("status = %q, want completed", tasks[0].Status)
	}

	// Update task
	if err := updateTask(dir, testDiscordID, task.ID, TaskInput{Title: "Updated", Priority: "high", Recurrence: "none"}); err != nil {
		t.Fatalf("updateTask error: %v", err)
	}
	tasks, _ = getTasks(dir, testDiscordID)
	if tasks[0].Title != "Updated" {
		t.Errorf("title = %q, want Updated", tasks[0].Title)
	}

	// Delete
	if err := deleteTask(dir, testDiscordID, task.ID); err != nil {
		t.Fatalf("deleteTask error: %v", err)
	}
	tasks, _ = getTasks(dir, testDiscordID)
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks after delete, got %d", len(tasks))
	}
}

func TestTasks_IsolatedByUser(t *testing.T) {
	dir := t.TempDir()
	createTask(dir, "user_a", TaskInput{Title: "Task A", Recurrence: "none"})
	createTask(dir, "user_b", TaskInput{Title: "Task B", Recurrence: "none"})

	tasksA, _ := getTasks(dir, "user_a")
	tasksB, _ := getTasks(dir, "user_b")
	if len(tasksA) != 1 || tasksA[0].Title != "Task A" {
		t.Error("user_a should see only their task")
	}
	if len(tasksB) != 1 || tasksB[0].Title != "Task B" {
		t.Error("user_b should see only their task")
	}
}

func TestTasks_CorruptFile(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(dir+"/tasks.json", []byte("not valid json{{"), 0644)
	tasks, err := getTasks(dir, testDiscordID)
	if err != nil {
		t.Fatalf("corrupt file should not error, got: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks from corrupt file, got %d", len(tasks))
	}
}

// ─── Transaction tests ────────────────────────────────────────────────────────

func TestTransactions_CRUD(t *testing.T) {
	dir := t.TempDir()

	txs, _ := getTransactions(dir, testDiscordID)
	if len(txs) != 0 {
		t.Errorf("expected 0 transactions, got %d", len(txs))
	}

	tx, err := createTransaction(dir, testDiscordID, TransactionInput{
		Type: "expense", Amount: 50.0, Currency: "BRL", Category: "food", Date: "2026-03-20",
	})
	if err != nil {
		t.Fatalf("createTransaction error: %v", err)
	}
	if tx.ID == "" {
		t.Error("transaction has no ID")
	}

	txs, _ = getTransactions(dir, testDiscordID)
	if len(txs) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(txs))
	}

	if err := deleteTransaction(dir, testDiscordID, tx.ID); err != nil {
		t.Fatalf("deleteTransaction error: %v", err)
	}
	txs, _ = getTransactions(dir, testDiscordID)
	if len(txs) != 0 {
		t.Errorf("expected 0 after delete, got %d", len(txs))
	}
}

func TestFinanceSummary(t *testing.T) {
	dir := t.TempDir()
	createTransaction(dir, testDiscordID, TransactionInput{Type: "income", Amount: 1000.0, Currency: "BRL", Category: "salary", Date: "2026-03-01"})
	createTransaction(dir, testDiscordID, TransactionInput{Type: "expense", Amount: 200.0, Currency: "BRL", Category: "food", Date: "2026-03-15"})

	sum, err := getFinanceSummary(dir, testDiscordID)
	if err != nil {
		t.Fatalf("getFinanceSummary error: %v", err)
	}
	if sum.Income != 1000.0 {
		t.Errorf("income = %f, want 1000.0", sum.Income)
	}
	if sum.Expenses != 200.0 {
		t.Errorf("expenses = %f, want 200.0", sum.Expenses)
	}
	if sum.Balance != 800.0 {
		t.Errorf("balance = %f, want 800.0", sum.Balance)
	}
}

func TestGetCategories(t *testing.T) {
	dir := t.TempDir()
	createTransaction(dir, testDiscordID, TransactionInput{Type: "expense", Amount: 10, Currency: "BRL", Category: "food", Date: "2026-03-01"})
	createTransaction(dir, testDiscordID, TransactionInput{Type: "expense", Amount: 20, Currency: "BRL", Category: "food", Date: "2026-03-02"})
	createTransaction(dir, testDiscordID, TransactionInput{Type: "income", Amount: 100, Currency: "BRL", Category: "salary", Date: "2026-03-03"})

	cats, err := getCategories(dir, testDiscordID)
	if err != nil {
		t.Fatalf("getCategories error: %v", err)
	}
	if len(cats) != 2 {
		t.Errorf("expected 2 categories, got %d: %v", len(cats), cats)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "c:/! A1/Astflye Organize/app"
go test -run "TestTasks|TestTransactions|TestFinanceSummary|TestGetCategories" -v
```

Expected: FAIL — types and functions undefined

- [ ] **Step 3: Create app/data.go**

```go
package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ─── Structs ──────────────────────────────────────────────────────────────────

type Task struct {
	ID            string `json:"id"`
	UserDiscordID string `json:"user_discord_id"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Status        string `json:"status"`
	Priority      string `json:"priority"`
	Category      string `json:"category"`
	Recurrence    string `json:"recurrence"`
	DueDate       string `json:"due_date"`
	CompletedAt   string `json:"completed_at"`
	CreatedAt     string `json:"created_at"`
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

type Transaction struct {
	ID            string  `json:"id"`
	UserDiscordID string  `json:"user_discord_id"`
	Type          string  `json:"type"`
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

// ─── File helpers ─────────────────────────────────────────────────────────────

var (
	taskMu sync.RWMutex
	txMu   sync.RWMutex
)

func readJSON[T any](path string) ([]T, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return []T{}, nil
	}
	if err != nil {
		return []T{}, nil
	}
	var items []T
	if err := json.Unmarshal(data, &items); err != nil {
		return []T{}, nil // corrupt file → empty
	}
	return items, nil
}

func writeJSON[T any](path string, items []T) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func tasksPath(dir string) string      { return filepath.Join(dir, "tasks.json") }
func transactionsPath(dir string) string { return filepath.Join(dir, "finance.json") }

// ─── Tasks CRUD ───────────────────────────────────────────────────────────────

func getTasks(dir, discordID string) ([]Task, error) {
	taskMu.RLock()
	all, err := readJSON[Task](tasksPath(dir))
	taskMu.RUnlock()
	if err != nil {
		return nil, err
	}
	var out []Task
	for _, t := range all {
		if t.UserDiscordID == discordID {
			out = append(out, t)
		}
	}
	if out == nil {
		out = []Task{}
	}
	return out, nil
}

func createTask(dir, discordID string, in TaskInput) (Task, error) {
	taskMu.Lock()
	defer taskMu.Unlock()

	all, _ := readJSON[Task](tasksPath(dir))
	t := Task{
		ID:            uuid.New().String(),
		UserDiscordID: discordID,
		Title:         in.Title,
		Description:   in.Description,
		Status:        "pending",
		Priority:      in.Priority,
		Category:      in.Category,
		Recurrence:    in.Recurrence,
		DueDate:       in.DueDate,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	if t.Priority == "" {
		t.Priority = "medium"
	}
	if t.Recurrence == "" {
		t.Recurrence = "none"
	}
	all = append(all, t)
	return t, writeJSON(tasksPath(dir), all)
}

func updateTask(dir, discordID, id string, in TaskInput) error {
	taskMu.Lock()
	defer taskMu.Unlock()

	all, _ := readJSON[Task](tasksPath(dir))
	for i, t := range all {
		if t.ID == id && t.UserDiscordID == discordID {
			all[i].Title = in.Title
			all[i].Description = in.Description
			all[i].Priority = in.Priority
			all[i].Category = in.Category
			all[i].Recurrence = in.Recurrence
			all[i].DueDate = in.DueDate
			if in.Status != "" {
				all[i].Status = in.Status
			}
			return writeJSON(tasksPath(dir), all)
		}
	}
	return nil
}

func updateTaskStatus(dir, discordID, id, status string) error {
	taskMu.Lock()
	defer taskMu.Unlock()

	all, _ := readJSON[Task](tasksPath(dir))
	for i, t := range all {
		if t.ID == id && t.UserDiscordID == discordID {
			all[i].Status = status
			if status == "completed" {
				all[i].CompletedAt = time.Now().UTC().Format(time.RFC3339)
			}
			return writeJSON(tasksPath(dir), all)
		}
	}
	return nil
}

func deleteTask(dir, discordID, id string) error {
	taskMu.Lock()
	defer taskMu.Unlock()

	all, _ := readJSON[Task](tasksPath(dir))
	filtered := all[:0]
	for _, t := range all {
		if !(t.ID == id && t.UserDiscordID == discordID) {
			filtered = append(filtered, t)
		}
	}
	return writeJSON(tasksPath(dir), filtered)
}

// ─── Transactions CRUD ────────────────────────────────────────────────────────

func getTransactions(dir, discordID string) ([]Transaction, error) {
	txMu.RLock()
	all, err := readJSON[Transaction](transactionsPath(dir))
	txMu.RUnlock()
	if err != nil {
		return nil, err
	}
	var out []Transaction
	for _, tx := range all {
		if tx.UserDiscordID == discordID {
			out = append(out, tx)
		}
	}
	if out == nil {
		out = []Transaction{}
	}
	return out, nil
}

func createTransaction(dir, discordID string, in TransactionInput) (Transaction, error) {
	txMu.Lock()
	defer txMu.Unlock()

	all, _ := readJSON[Transaction](transactionsPath(dir))
	date := in.Date
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}
	currency := in.Currency
	if currency == "" {
		currency = "BRL"
	}
	tx := Transaction{
		ID:            uuid.New().String(),
		UserDiscordID: discordID,
		Type:          in.Type,
		Amount:        in.Amount,
		Currency:      currency,
		Category:      in.Category,
		Description:   in.Description,
		Recurring:     in.Recurring,
		Date:          date,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	all = append(all, tx)
	return tx, writeJSON(transactionsPath(dir), all)
}

func updateTransaction(dir, discordID, id string, in TransactionInput) error {
	txMu.Lock()
	defer txMu.Unlock()

	all, _ := readJSON[Transaction](transactionsPath(dir))
	for i, tx := range all {
		if tx.ID == id && tx.UserDiscordID == discordID {
			all[i].Type = in.Type
			all[i].Amount = in.Amount
			all[i].Currency = in.Currency
			all[i].Category = in.Category
			all[i].Description = in.Description
			all[i].Recurring = in.Recurring
			if in.Date != "" {
				all[i].Date = in.Date
			}
			return writeJSON(transactionsPath(dir), all)
		}
	}
	return nil
}

func deleteTransaction(dir, discordID, id string) error {
	txMu.Lock()
	defer txMu.Unlock()

	all, _ := readJSON[Transaction](transactionsPath(dir))
	filtered := all[:0]
	for _, tx := range all {
		if !(tx.ID == id && tx.UserDiscordID == discordID) {
			filtered = append(filtered, tx)
		}
	}
	return writeJSON(transactionsPath(dir), filtered)
}

func getFinanceSummary(dir, discordID string) (FinanceSummary, error) {
	txs, err := getTransactions(dir, discordID)
	if err != nil {
		return FinanceSummary{}, err
	}
	var income, expenses float64
	for _, tx := range txs {
		switch tx.Type {
		case "income":
			income += tx.Amount
		case "expense":
			expenses += tx.Amount
		}
	}
	return FinanceSummary{
		Income:   income,
		Expenses: expenses,
		Balance:  income - expenses,
		Period:   "all",
	}, nil
}

func getCategories(dir, discordID string) ([]string, error) {
	txs, err := getTransactions(dir, discordID)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var cats []string
	for _, tx := range txs {
		if tx.Category != "" && !seen[tx.Category] {
			seen[tx.Category] = true
			cats = append(cats, tx.Category)
		}
	}
	if cats == nil {
		cats = []string{}
	}
	return cats, nil
}
```

- [ ] **Step 4: Run tests**

```bash
cd "c:/! A1/Astflye Organize/app"
go test -run "TestTasks|TestTransactions|TestFinanceSummary|TestGetCategories" -v
```

Expected: PASS all 7 tests

- [ ] **Step 5: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/data.go app/data_test.go
git commit -m "feat(app): data.go — JSON CRUD for tasks and finance with per-file mutex"
```

---

## Task 5: Rewrite app/app.go

**Files:** `app/app.go`

- [ ] **Step 1: Rewrite app/app.go**

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/oauth2"
)

type App struct {
	ctx      context.Context
	cfg      *Config
	oauthCfg *oauth2.Config
	oauthSrv *http.Server
	ss       *stateStore

	mu          sync.Mutex
	accessToken string
	discordID   string
	username    string
	globalName  string
	avatar      string

	loopMu      sync.Mutex
	loopRunning bool
}

func NewApp(cfg *Config) *App {
	return &App{
		cfg:      cfg,
		oauthCfg: newOAuth2Config(cfg),
		ss:       newStateStore(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if err := a.startOAuthServer(); err != nil {
		fmt.Printf("failed to start OAuth server: %v\n", err)
	}
}

// ─── Login flow ───────────────────────────────────────────────────────────────

// StartLogin starts the loopback receiver, builds the Discord OAuth URL, opens browser.
func (a *App) StartLogin() error {
	a.loopMu.Lock()
	running := a.loopRunning
	a.loopMu.Unlock()
	if running {
		return errors.New("login already in progress")
	}

	// Bind loopback listener first to reserve the port
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("no free port: %w", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	doneURL := fmt.Sprintf("http://127.0.0.1:%d/auth/done", port)

	a.loopMu.Lock()
	a.loopRunning = true
	a.loopMu.Unlock()

	go a.listenForTokens(ln, port)

	// Generate CSRF state encoding the doneURL
	state := a.ss.Generate(doneURL)
	authURL := a.oauthCfg.AuthCodeURL(state, oauth2.AccessTypeOnline)
	runtime.BrowserOpenURL(a.ctx, authURL)
	return nil
}

func (a *App) listenForTokens(ln net.Listener, port int) {
	defer func() {
		a.loopMu.Lock()
		a.loopRunning = false
		a.loopMu.Unlock()
	}()

	mux := http.NewServeMux()
	srv := &http.Server{Handler: mux}

	// Timeout: if user never authorizes, shut down after 5 minutes
	timer := time.AfterFunc(5*time.Minute, func() {
		srv.Shutdown(context.Background())
		runtime.EventsEmit(a.ctx, "auth:timeout")
	})

	mux.HandleFunc("/auth/done", func(w http.ResponseWriter, r *http.Request) {
		timer.Stop()
		defer func() {
			go func() {
				time.Sleep(500 * time.Millisecond)
				srv.Shutdown(context.Background())
			}()
		}()

		errParam := r.URL.Query().Get("error")
		if errParam != "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(errorPage(errParam)))
			runtime.EventsEmit(a.ctx, "auth:error", errParam)
			return
		}

		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "missing token", 400)
			return
		}

		a.mu.Lock()
		a.accessToken = token
		a.discordID = r.URL.Query().Get("discord_id")
		a.username = r.URL.Query().Get("username")
		a.globalName = r.URL.Query().Get("global_name")
		a.avatar = r.URL.Query().Get("avatar")
		a.mu.Unlock()

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(successPage()))
		runtime.EventsEmit(a.ctx, "auth:success")
	})

	srv.Serve(ln)
}

func successPage() string {
	return `<!DOCTYPE html><html><body style="background:#08050f;color:#b455ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><h2 style="font-size:1.3rem;margin:0">&#10003; Login realizado!</h2><p style="margin:0;font-size:.9rem;opacity:.6">Pode fechar esta aba.</p></body></html>`
}

func errorPage(err string) string {
	msg := "Erro ao fazer login."
	if err == "not_member" {
		msg = "Você precisa entrar no servidor Discord primeiro."
	}
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="background:#08050f;color:#ff5555;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><h2 style="font-size:1.3rem;margin:0">&#10007; %s</h2><p style="margin:0;font-size:.9rem;opacity:.6">Pode fechar esta aba e tentar novamente.</p></body></html>`, msg)
}

// ─── User info getters ────────────────────────────────────────────────────────

func (a *App) GetAccessToken() string  { a.mu.Lock(); defer a.mu.Unlock(); return a.accessToken }
func (a *App) GetDiscordID() string    { a.mu.Lock(); defer a.mu.Unlock(); return a.discordID }
func (a *App) GetUsername() string     { a.mu.Lock(); defer a.mu.Unlock(); return a.username }
func (a *App) GetGlobalName() string   { a.mu.Lock(); defer a.mu.Unlock(); return a.globalName }
func (a *App) GetAvatar() string       { a.mu.Lock(); defer a.mu.Unlock(); return a.avatar }
func (a *App) IsAuthenticated() bool   { a.mu.Lock(); defer a.mu.Unlock(); return a.accessToken != "" }

func (a *App) Logout() {
	a.mu.Lock()
	a.accessToken, a.discordID, a.username, a.globalName, a.avatar = "", "", "", "", ""
	a.mu.Unlock()
}

// ─── Data bridge methods ──────────────────────────────────────────────────────

func (a *App) appDataDir() (string, error) {
	return dataDir()
}

func (a *App) currentDiscordID() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.discordID
}

func (a *App) GetTasks() ([]Task, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return nil, err
	}
	return getTasks(dir, a.currentDiscordID())
}

func (a *App) CreateTask(input TaskInput) (Task, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return Task{}, err
	}
	return createTask(dir, a.currentDiscordID(), input)
}

func (a *App) UpdateTask(id string, input TaskInput) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return updateTask(dir, a.currentDiscordID(), id, input)
}

func (a *App) UpdateTaskStatus(id, status string) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return updateTaskStatus(dir, a.currentDiscordID(), id, status)
}

func (a *App) DeleteTask(id string) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return deleteTask(dir, a.currentDiscordID(), id)
}

func (a *App) GetTransactions() ([]Transaction, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return nil, err
	}
	return getTransactions(dir, a.currentDiscordID())
}

func (a *App) CreateTransaction(input TransactionInput) (Transaction, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return Transaction{}, err
	}
	return createTransaction(dir, a.currentDiscordID(), input)
}

func (a *App) UpdateTransaction(id string, input TransactionInput) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return updateTransaction(dir, a.currentDiscordID(), id, input)
}

func (a *App) DeleteTransaction(id string) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return deleteTransaction(dir, a.currentDiscordID(), id)
}

func (a *App) GetFinanceSummary(period string) (FinanceSummary, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return FinanceSummary{}, err
	}
	return getFinanceSummary(dir, a.currentDiscordID())
}

func (a *App) GetCategories() ([]string, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return nil, err
	}
	return getCategories(dir, a.currentDiscordID())
}

// url package imported — ensure it's used (used in auth.go via net/url indirectly)
var _ = url.QueryEscape
```

- [ ] **Step 2: Compile check**

```bash
cd "c:/! A1/Astflye Organize/app"
go build ./...
```

Expected: no errors (or only "undefined: embed" from main.go — that's fixed in next task)

- [ ] **Step 3: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/app.go
git commit -m "feat(app): app.go — StartLogin, loopback, user getters, data bridge methods"
```

---

## Task 6: Rewrite app/main.go

**Files:** `app/main.go`

- [ ] **Step 1: Rewrite app/main.go**

```go
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config: %v\n\nCreate %AppData%\\Astflye\\.env with:\n  DISCORD_CLIENT_ID=...\n  DISCORD_CLIENT_SECRET=...\n  DISCORD_GUILD_ID=...\n  DISCORD_REDIRECT_URI=http://localhost:3005/auth/callback\n", err)
	}

	app := NewApp(cfg)

	err = wails.Run(&options.App{
		Title:  "Astflye Life",
		Width:  1440,
		Height: 900,
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

- [ ] **Step 2: Full Go compile check**

```bash
cd "c:/! A1/Astflye Organize/app"
go build ./...
```

Expected: no errors

- [ ] **Step 3: Run all Go tests**

```bash
cd "c:/! A1/Astflye Organize/app"
go test ./... -v
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/main.go
git commit -m "feat(app): main.go — load config, create App, start Wails"
```

---

## Task 7: Update Wails bridge files

**Files:** `app/frontend/wailsjs/go/main/App.d.ts`, `app/frontend/wailsjs/go/main/App.js`

- [ ] **Step 1: Rewrite App.d.ts**

```typescript
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

import {main} from '../models';

export function CreateTask(arg1:main.TaskInput):Promise<main.Task>;

export function CreateTransaction(arg1:main.TransactionInput):Promise<main.Transaction>;

export function DeleteTask(arg1:string):Promise<void>;

export function DeleteTransaction(arg1:string):Promise<void>;

export function GetAccessToken():Promise<string>;

export function GetAvatar():Promise<string>;

export function GetCategories():Promise<Array<string>>;

export function GetDiscordID():Promise<string>;

export function GetFinanceSummary(arg1:string):Promise<main.FinanceSummary>;

export function GetGlobalName():Promise<string>;

export function GetTasks():Promise<Array<main.Task>>;

export function GetTransactions():Promise<Array<main.Transaction>>;

export function GetUsername():Promise<string>;

export function IsAuthenticated():Promise<boolean>;

export function Logout():Promise<void>;

export function StartLogin():Promise<void>;

export function UpdateTask(arg1:string,arg2:main.TaskInput):Promise<void>;

export function UpdateTaskStatus(arg1:string,arg2:string):Promise<void>;

export function UpdateTransaction(arg1:string,arg2:main.TransactionInput):Promise<void>;
```

- [ ] **Step 2: Rewrite App.js**

```javascript
// @ts-check
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

export function CreateTask(arg1) {
  return window['go']['main']['App']['CreateTask'](arg1);
}

export function CreateTransaction(arg1) {
  return window['go']['main']['App']['CreateTransaction'](arg1);
}

export function DeleteTask(arg1) {
  return window['go']['main']['App']['DeleteTask'](arg1);
}

export function DeleteTransaction(arg1) {
  return window['go']['main']['App']['DeleteTransaction'](arg1);
}

export function GetAccessToken() {
  return window['go']['main']['App']['GetAccessToken']();
}

export function GetAvatar() {
  return window['go']['main']['App']['GetAvatar']();
}

export function GetCategories() {
  return window['go']['main']['App']['GetCategories']();
}

export function GetDiscordID() {
  return window['go']['main']['App']['GetDiscordID']();
}

export function GetFinanceSummary(arg1) {
  return window['go']['main']['App']['GetFinanceSummary'](arg1);
}

export function GetGlobalName() {
  return window['go']['main']['App']['GetGlobalName']();
}

export function GetTasks() {
  return window['go']['main']['App']['GetTasks']();
}

export function GetTransactions() {
  return window['go']['main']['App']['GetTransactions']();
}

export function GetUsername() {
  return window['go']['main']['App']['GetUsername']();
}

export function IsAuthenticated() {
  return window['go']['main']['App']['IsAuthenticated']();
}

export function Logout() {
  return window['go']['main']['App']['Logout']();
}

export function StartLogin() {
  return window['go']['main']['App']['StartLogin']();
}

export function UpdateTask(arg1, arg2) {
  return window['go']['main']['App']['UpdateTask'](arg1, arg2);
}

export function UpdateTaskStatus(arg1, arg2) {
  return window['go']['main']['App']['UpdateTaskStatus'](arg1, arg2);
}

export function UpdateTransaction(arg1, arg2) {
  return window['go']['main']['App']['UpdateTransaction'](arg1, arg2);
}
```

- [ ] **Step 3: Create/update models.ts for Wails types**

Check if `app/frontend/wailsjs/go/models.ts` exists; create or update it:

```typescript
export namespace main {
  export class FinanceSummary {
    income: number;
    expenses: number;
    balance: number;
    period: string;
  }
  export class Task {
    id: string;
    user_discord_id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    recurrence: string;
    due_date: string;
    completed_at: string;
    created_at: string;
  }
  export class TaskInput {
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    recurrence: string;
    due_date: string;
  }
  export class Transaction {
    id: string;
    user_discord_id: string;
    type: string;
    amount: number;
    currency: string;
    category: string;
    description: string;
    recurring: boolean;
    date: string;
    created_at: string;
  }
  export class TransactionInput {
    type: string;
    amount: number;
    currency: string;
    category: string;
    description: string;
    recurring: boolean;
    date: string;
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/frontend/wailsjs/
git commit -m "feat(bridge): update Wails bridge — add data methods, GetDiscordID, no-arg StartLogin"
```

---

## Task 8: Update frontend store and api.ts

**Files:** `app/frontend/src/store/auth.ts`, `app/frontend/src/lib/api.ts`

- [ ] **Step 1: Rewrite store/auth.ts**

```typescript
import { create } from 'zustand'

export interface StoredUser {
  username: string
  globalName: string
  avatar: string
  discordId: string
}

interface AuthState {
  accessToken: string | null
  user: StoredUser | null
  setTokens: (access: string, user: StoredUser) => void
  clear: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  setTokens: (access, user) => set({ accessToken: access, user }),
  clear: () => set({ accessToken: null, user: null }),
  isAuthenticated: () => !!get().accessToken,
}))
```

- [ ] **Step 2: Rewrite lib/api.ts**

```typescript
// Wails bridge wrapper — no HTTP fetch.
// All calls go through window.go.main.App.* (Wails IPC).

import type { main } from '../../wailsjs/go/models'
import {
  GetTasks, CreateTask, UpdateTask, UpdateTaskStatus, DeleteTask,
  GetTransactions, CreateTransaction, UpdateTransaction, DeleteTransaction,
  GetFinanceSummary, GetCategories,
} from '../../wailsjs/go/main/App'

// Re-export bridge functions with typed aliases
export const api = {
  getTasks: () => GetTasks(),
  createTask: (input: main.TaskInput) => CreateTask(input),
  updateTask: (id: string, input: main.TaskInput) => UpdateTask(id, input),
  updateTaskStatus: (id: string, status: string) => UpdateTaskStatus(id, status),
  deleteTask: (id: string) => DeleteTask(id),

  getTransactions: () => GetTransactions(),
  createTransaction: (input: main.TransactionInput) => CreateTransaction(input),
  updateTransaction: (id: string, input: main.TransactionInput) => UpdateTransaction(id, input),
  deleteTransaction: (id: string) => DeleteTransaction(id),
  getFinanceSummary: (period = 'all') => GetFinanceSummary(period),
  getCategories: () => GetCategories(),
}
```

- [ ] **Step 3: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/frontend/src/store/auth.ts app/frontend/src/lib/api.ts
git commit -m "feat(frontend): simplify auth store, replace api.ts with Wails bridge wrapper"
```

---

## Task 9: Rewrite frontend hooks

**Files:** `app/frontend/src/hooks/useTasks.ts`, `app/frontend/src/hooks/useFinance.ts`, `app/frontend/src/hooks/useMe.ts`, `app/frontend/src/hooks/useSocial.ts`

- [ ] **Step 1: Rewrite useTasks.ts**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { main } from '../../../wailsjs/go/models'

export type Task = main.Task
export type TaskInput = main.TaskInput

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInput) => api.createTask(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) => api.updateTask(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateTaskStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
```

- [ ] **Step 2: Rewrite useFinance.ts**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { main } from '../../../wailsjs/go/models'

export type Transaction = main.Transaction
export type TransactionInput = main.TransactionInput
export type Summary = main.FinanceSummary

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => api.getTransactions(),
  })
}

export function useSummary(period = 'all') {
  return useQuery<Summary>({
    queryKey: ['summary', period],
    queryFn: () => api.getFinanceSummary(period),
  })
}

export function useCategories() {
  return useQuery<string[]>({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TransactionInput) => api.createTransaction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}
```

- [ ] **Step 3: Rewrite useMe.ts**

```typescript
import { useAuthStore } from '@/store/auth'

export interface User {
  discord_id: string
  username: string
  global_name: string
  avatar: string
}

export function useMe(): User | null {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return {
    discord_id: user.discordId,
    username: user.username,
    global_name: user.globalName,
    avatar: user.avatar,
  }
}
```

- [ ] **Step 4: Delete useSocial.ts**

```bash
rm "c:/! A1/Astflye Organize/app/frontend/src/hooks/useSocial.ts"
```

- [ ] **Step 5: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/frontend/src/hooks/
git commit -m "feat(frontend): rewrite hooks to use Wails bridge, delete useSocial"
```

---

## Task 10: Update pages

**Files:** `LoginPage.tsx`, `ProfilePage.tsx`, `SocialPage.tsx`, `AuthDonePage.tsx` (delete), `main.tsx`

- [ ] **Step 1: Simplify LoginPage.tsx**

Replace the `handleLogin` function and the `useEffect` for `auth:success`. Find and replace these sections in `app/frontend/src/pages/LoginPage.tsx`:

Replace the entire `useEffect` for `auth:success` (lines ~70-81) with:

```typescript
  useEffect(() => {
    window.runtime?.EventsOn('auth:success', async () => {
      const token      = await window.go?.main.App.GetAccessToken() ?? ''
      const username   = await window.go?.main.App.GetUsername()    ?? ''
      const globalName = await window.go?.main.App.GetGlobalName()  ?? ''
      const avatar     = await window.go?.main.App.GetAvatar()      ?? ''
      const discordId  = await window.go?.main.App.GetDiscordID()   ?? ''
      if (token) {
        setTokens(token, { username, globalName, avatar, discordId })
        navigate('/')
      }
    })
    window.runtime?.EventsOn('auth:error', (_: any, errCode: string) => {
      const messages: Record<string, string> = {
        not_member: 'Você precisa entrar no servidor Discord primeiro.',
        exchange_failed: 'Erro ao trocar código Discord. Tente novamente.',
        discord_error: 'Erro ao conectar com Discord. Tente novamente.',
      }
      setError(messages[errCode] ?? 'Erro desconhecido.')
      setLoading(false)
    })
    window.runtime?.EventsOn('auth:timeout', () => {
      setError('Login cancelado — tempo esgotado.')
      setLoading(false)
    })
  }, [setTokens, navigate])
```

Replace the `handleLogin` function with:

```typescript
  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await window.go?.main.App.StartLogin()
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao iniciar login')
      setLoading(false)
    }
  }
```

Also update the `declare global` block to add `GetDiscordID` and remove `StartLogin`'s `arg` parameter:

```typescript
declare global {
  interface Window {
    go?: {
      main: {
        App: {
          StartLogin: () => Promise<void>
          GetAccessToken: () => Promise<string>
          GetUsername: () => Promise<string>
          GetGlobalName: () => Promise<string>
          GetAvatar: () => Promise<string>
          GetDiscordID: () => Promise<string>
        }
      }
    }
    runtime?: {
      EventsOn: (event: string, cb: (...args: any[]) => void) => void
    }
  }
}
```

Also update `setTokens` call signature (now takes `(token, user)` not `(token, '', user)`):

The `setTokens` in the store now takes `(access: string, user: StoredUser)` — remove the empty refresh string `''` from calls.

- [ ] **Step 2: Update ProfilePage.tsx logout**

In `app/frontend/src/pages/ProfilePage.tsx`, find the `handleLogout` function and replace it with:

```typescript
  const handleLogout = async () => {
    await window.go?.main.App.Logout()
    useAuthStore.getState().clear()
    navigate('/login')
  }
```

Also add the `useAuthStore` import if missing:
```typescript
import { useAuthStore } from '@/store/auth'
```

And update any `me?.current_streak` / `me?.longest_streak` references — remove them since `useMe()` no longer returns those fields. If the ProfilePage renders streaks, replace with a placeholder or remove.

- [ ] **Step 3: Stub SocialPage.tsx**

Replace the entire content of `app/frontend/src/pages/SocialPage.tsx` with:

```typescript
export default function SocialPage() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', flexDirection: 'column', gap: 16,
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--primary)' }}>
        Social
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)' }}>
        Em breve...
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Delete AuthDonePage.tsx**

```bash
rm "c:/! A1/Astflye Organize/app/frontend/src/pages/AuthDonePage.tsx"
```

- [ ] **Step 5: Update main.tsx — remove /auth/done route**

In `app/frontend/src/main.tsx`, remove:
- The `import AuthDonePage` line
- The `<Route path="/auth/done" element={<AuthDonePage />} />` line

- [ ] **Step 6: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/frontend/src/pages/ app/frontend/src/main.tsx
git commit -m "feat(frontend): update pages — no-arg StartLogin, bridge logout, social stub, delete AuthDonePage"
```

---

## Task 11: Update vite.config.ts

**Files:** `app/frontend/vite.config.ts`

- [ ] **Step 1: Remove proxy**

Replace the entire file with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 2: Commit**

```bash
cd "c:/! A1/Astflye Organize"
git add app/frontend/vite.config.ts
git commit -m "chore(frontend): remove /api proxy from vite config"
```

---

## Task 12: Create .env config file

**Files:** `%AppData%\Astflye\.env` (user machine)

- [ ] **Step 1: Create the Astflye config directory and .env**

Run in PowerShell or cmd:

```powershell
$dir = "$env:APPDATA\Astflye"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
```

Then create `%AppData%\Astflye\.env` with content (fill in real values from your Discord developer portal at https://discord.com/developers/applications):

```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_GUILD_ID=your_server_id_here
DISCORD_REDIRECT_URI=http://localhost:3005/auth/callback
```

**Notes:**
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` come from your Discord app's OAuth2 page
- `DISCORD_GUILD_ID` is your Discord server's ID (right-click server → Copy Server ID, with Developer Mode enabled)
- `DISCORD_REDIRECT_URI` must be added to your Discord app's "Redirects" list on the OAuth2 page — add exactly `http://localhost:3005/auth/callback`
- `JWT_SECRET` is optional — auto-generated if missing

- [ ] **Step 2: Verify the file exists**

```powershell
Get-Content "$env:APPDATA\Astflye\.env"
```

---

## Task 13: Delete server/ directory

**Files:** `server/` (entire directory)

- [ ] **Step 1: Remove server directory from git**

```bash
cd "c:/! A1/Astflye Organize"
git rm -r server/
git rm start-server.bat
```

- [ ] **Step 2: Commit removal**

```bash
git commit -m "chore: remove server/ — embedded in Wails app"
```

---

## Task 14: Build and verify

- [ ] **Step 1: Run all Go tests**

```bash
cd "c:/! A1/Astflye Organize/app"
go test ./... -v
```

Expected: all tests PASS

- [ ] **Step 2: Go build check**

```bash
cd "c:/! A1/Astflye Organize/app"
go build ./...
```

Expected: no errors

- [ ] **Step 3: Frontend TypeScript check**

```bash
cd "c:/! A1/Astflye Organize/app/frontend"
npm run build
```

Expected: build succeeds (or type errors — fix any `setTokens` call sites that still pass 3 arguments)

- [ ] **Step 4: Fix any TypeScript errors**

Common issues after the hook rewrites:
- `TasksPage.tsx` or `FinancePage.tsx` calling `useTasks` with filter params → remove filters (bridge returns all, filter client-side)
- `setTokens(token, '', user)` → change to `setTokens(token, user)` (3-arg to 2-arg)
- `me?.current_streak` → remove or replace with `0`
- Imports of deleted `apiFetch` → update to use `api.*`

Fix each error, then re-run `npm run build` until clean.

- [ ] **Step 5: Launch with wails dev**

```bash
cd "c:/! A1/Astflye Organize/app"
wails dev
```

Expected:
- App window opens
- Login page visible
- No console errors about missing server

- [ ] **Step 6: Test Discord login**

1. Click "Login com Discord"
2. System browser opens Discord authorize page
3. Authorize the app
4. Browser shows "Login realizado! Pode fechar esta aba."
5. Wails app navigates to dashboard automatically
6. Username and avatar visible in sidebar

- [ ] **Step 7: Final commit**

```bash
cd "c:/! A1/Astflye Organize"
git add -A
git commit -m "feat: Discord login + local JSON storage — server removed, all logic in Wails app"
```
