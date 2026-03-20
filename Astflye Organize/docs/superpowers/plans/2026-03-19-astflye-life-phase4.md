# Astflye Life — Phase 4: Polish, Assistant + Settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the motivational assistant (rule-based always-on + optional Claude API), in-app notification system, settings page (server URL, AI toggle, theme), and final project hygiene (README, .env.example, cleanup).

**Architecture:** Assistant logic is a pure Go package on the server — no external calls for rule-based mode. Claude API integration is gated by `CLAUDE_API_KEY` in `.env`. Notifications are delivered via the existing WebSocket hub. Settings are stored client-side in Zustand (persisted to `localStorage` via Wails).

**Prerequisite:** Phase 3 complete.

---

## File Map

### Server
| File | Responsibility |
|---|---|
| `server/assistant/rules.go` | Rule-based message engine (streaks, completions, progress) |
| `server/assistant/claude.go` | Claude API call (optional, gated by env var) |
| `server/assistant/assistant.go` | Facade: picks rule-based or AI depending on config |
| `server/handlers/assistant.go` | POST /assistant/nudge endpoint |
| `server/main.go` | Register assistant route |

### Frontend
| File | Responsibility |
|---|---|
| `app/frontend/src/store/settings.ts` | Zustand settings store (server URL, AI enabled, etc.) |
| `app/frontend/src/store/notifications.ts` | In-app notification queue |
| `app/frontend/src/components/ui/NotificationToast.tsx` | Toast notification component |
| `app/frontend/src/app/(dashboard)/settings/page.tsx` | Settings page |
| `README.md` | Project setup guide |

---

## Task 1: Rule-based Motivational Assistant (Server)

**Files:**
- Create: `server/assistant/rules.go`
- Create: `server/assistant/claude.go`
- Create: `server/assistant/assistant.go`
- Test: `server/assistant/rules_test.go`

- [ ] **Step 1: Write failing tests**

Create `server/assistant/rules_test.go`:
```go
package assistant_test

import (
	"testing"
	"github.com/astflye/life/server/assistant"
)

func TestRuleEngine_StreakMilestone(t *testing.T) {
	ctx := assistant.Context{
		CurrentStreak:    7,
		DailyProgress:    0.5,
		CompletedToday:   3,
		TotalToday:       6,
	}
	msg := assistant.RuleBasedMessage(ctx)
	if msg == "" {
		t.Error("expected a message for 7-day streak, got empty string")
	}
}

func TestRuleEngine_AllDone(t *testing.T) {
	ctx := assistant.Context{
		CurrentStreak:  1,
		DailyProgress:  1.0,
		CompletedToday: 5,
		TotalToday:     5,
	}
	msg := assistant.RuleBasedMessage(ctx)
	if msg == "" {
		t.Error("expected a message when all tasks done")
	}
}

func TestRuleEngine_NoTasks(t *testing.T) {
	ctx := assistant.Context{TotalToday: 0}
	msg := assistant.RuleBasedMessage(ctx)
	// Should still return something (motivate to create tasks)
	if msg == "" {
		t.Error("expected a message even with no tasks")
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./assistant/... -v
```

- [ ] **Step 3: Create assistant package directory**

```bash
mkdir -p "c:/! A1/Astflye Organize/server/assistant"
```

- [ ] **Step 4: Implement rules.go**

Create `server/assistant/rules.go`:
```go
package assistant

import "fmt"

// Context contains the user's current state for assistant evaluation.
type Context struct {
	CurrentStreak  int
	LongestStreak  int
	DailyProgress  float64 // 0.0–1.0
	CompletedToday int
	TotalToday     int
	MonthlyBalance float64
}

// RuleBasedMessage returns a motivational message based on user context.
// Priority order: all-done > streak milestone > progress-based > no-tasks
func RuleBasedMessage(ctx Context) string {
	// All tasks done
	if ctx.TotalToday > 0 && ctx.CompletedToday == ctx.TotalToday {
		if ctx.CurrentStreak >= 7 {
			return fmt.Sprintf("🔥 %d-day streak AND all tasks done? You're legendary.", ctx.CurrentStreak)
		}
		return "✅ All done for today! Enjoy your well-earned rest."
	}

	// Streak milestones
	switch ctx.CurrentStreak {
	case 1:
		return "Day 1! Every legend starts somewhere. Keep going."
	case 3:
		return "3 days in — the habit is forming. Don't break the chain."
	case 7:
		return "🔥 7-day streak! You're unstoppable."
	case 14:
		return "💪 Two weeks straight. You're building something real."
	case 30:
		return "🏆 30 days. You've leveled up your life. Seriously."
	}
	if ctx.CurrentStreak > 30 && ctx.CurrentStreak%10 == 0 {
		return fmt.Sprintf("🌟 %d days strong. You're in rare company now.", ctx.CurrentStreak)
	}

	// Progress-based
	if ctx.TotalToday == 0 {
		return "No tasks yet today. What's the first thing on your list?"
	}
	remaining := ctx.TotalToday - ctx.CompletedToday
	if ctx.DailyProgress >= 0.8 {
		return fmt.Sprintf("Almost there! %d task(s) left — finish strong.", remaining)
	}
	if ctx.DailyProgress >= 0.5 {
		return fmt.Sprintf("Past the halfway mark. %d more to go — you've got this.", remaining)
	}
	if ctx.DailyProgress > 0 {
		return fmt.Sprintf("Good start! %d task(s) done. Keep the momentum.", ctx.CompletedToday)
	}

	return fmt.Sprintf("You have %d tasks today. Start with the hardest one first.", ctx.TotalToday)
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./assistant/... -v
```

- [ ] **Step 6: Implement claude.go**

Create `server/assistant/claude.go`:
```go
package assistant

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type ClaudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	Messages  []ClaudeMessage `json:"messages"`
}

type ClaudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ClaudeResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}

// AIMessage calls Claude API to generate a personalized motivational message.
// Returns empty string on any error (caller falls back to rule-based).
func AIMessage(ctx Context, apiKey, model string) string {
	if apiKey == "" {
		return ""
	}

	prompt := fmt.Sprintf(
		"You are a concise, warm, and motivating productivity assistant. "+
			"Give a single short message (max 2 sentences) to encourage the user based on their stats:\n"+
			"- Streak: %d days\n- Today: %d/%d tasks done (%.0f%%)\n- Monthly balance: R$ %.2f\n\n"+
			"Be direct and genuine. No emojis unless they add value. No fluff.",
		ctx.CurrentStreak, ctx.CompletedToday, ctx.TotalToday,
		ctx.DailyProgress*100, ctx.MonthlyBalance,
	)

	reqBody, _ := json.Marshal(ClaudeRequest{
		Model:     model,
		MaxTokens: 150,
		Messages:  []ClaudeMessage{{Role: "user", Content: prompt}},
	})

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		return ""
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return ""
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result ClaudeResponse
	if err := json.Unmarshal(body, &result); err != nil || len(result.Content) == 0 {
		return ""
	}
	return result.Content[0].Text
}
```

Create `server/assistant/assistant.go`:
```go
package assistant

// Get returns a motivational message. Uses AI if apiKey is provided, otherwise rule-based.
func Get(ctx Context, apiKey, model string) string {
	if apiKey != "" {
		if msg := AIMessage(ctx, apiKey, model); msg != "" {
			return msg
		}
	}
	return RuleBasedMessage(ctx)
}
```

- [ ] **Step 7: Commit**

```bash
git add server/assistant/
git commit -m "feat(server): motivational assistant — rule-based engine + optional Claude API"
```

---

## Task 2: Assistant Endpoint

**Files:**
- Create: `server/handlers/assistant.go`

- [ ] **Step 1: Write failing test**

Create `server/handlers/assistant_test.go`:
```go
package handlers_test

import (
	"net/http/httptest"
	"testing"

	"github.com/astflye/life/server/db"
	"github.com/astflye/life/server/handlers"
	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func TestAssistantNudge_ReturnsMessage(t *testing.T) {
	database, _ := db.Init(":memory:")
	userID := uuid.New().String()
	database.Create(&models.User{ID: userID, DiscordID: "disc-asst", Username: "Asst", CurrentStreak: 5})

	app := fiber.New()
	h := handlers.NewAssistantHandler(database, "", "")
	app.Use(func(c *fiber.Ctx) error { c.Locals("userID", userID); return c.Next() })
	app.Post("/assistant/nudge", h.Nudge)

	req := httptest.NewRequest("POST", "/assistant/nudge", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -run TestAssistant -v
```

- [ ] **Step 3: Implement assistant handler**

Create `server/handlers/assistant.go`:
```go
package handlers

import (
	"time"

	"github.com/astflye/life/server/assistant"
	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type AssistantHandler struct {
	db       *gorm.DB
	apiKey   string
	model    string
}

func NewAssistantHandler(db *gorm.DB, apiKey, model string) *AssistantHandler {
	return &AssistantHandler{db: db, apiKey: apiKey, model: model}
}

func (h *AssistantHandler) Nudge(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	// Count today's tasks
	today := time.Now().Truncate(24 * time.Hour)
	var total, completed int64
	h.db.Model(&models.Task{}).Where("user_id = ? AND recurrence = 'daily'", userID).Count(&total)
	h.db.Model(&models.Task{}).Where("user_id = ? AND recurrence = 'daily' AND status = 'completed' AND completed_at >= ?", userID, today).Count(&completed)

	var progress float64
	if total > 0 {
		progress = float64(completed) / float64(total)
	}

	// Monthly balance
	var income, expenses float64
	monthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.Local)
	h.db.Model(&models.Transaction{}).Where("user_id = ? AND type = 'income' AND date >= ?", userID, monthStart).Select("COALESCE(SUM(amount),0)").Scan(&income)
	h.db.Model(&models.Transaction{}).Where("user_id = ? AND type = 'expense' AND date >= ?", userID, monthStart).Select("COALESCE(SUM(amount),0)").Scan(&expenses)

	ctx := assistant.Context{
		CurrentStreak:  user.CurrentStreak,
		LongestStreak:  user.LongestStreak,
		DailyProgress:  progress,
		CompletedToday: int(completed),
		TotalToday:     int(total),
		MonthlyBalance: income - expenses,
	}

	msg := assistant.Get(ctx, h.apiKey, h.model)
	return c.JSON(fiber.Map{"message": msg, "mode": map[bool]string{true: "ai", false: "rule"}[h.apiKey != ""]})
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -run TestAssistant -v
```

- [ ] **Step 5: Register route in main.go**

Add to `server/main.go`:
```go
assistantHandler := handlers.NewAssistantHandler(database, cfg.ClaudeAPIKey, cfg.ClaudeModel)
api.Post("/assistant/nudge", assistantHandler.Nudge)
```

- [ ] **Step 6: Commit**

```bash
git add server/handlers/assistant.go server/handlers/assistant_test.go server/main.go
git commit -m "feat(server): POST /assistant/nudge — rule-based + optional AI mode"
```

---

## Task 3: Notification System (Frontend)

**Files:**
- Create: `app/frontend/src/store/notifications.ts`
- Create: `app/frontend/src/components/ui/NotificationToast.tsx`

- [ ] **Step 1: Write failing test**

Create `app/frontend/src/__tests__/notifications.test.ts`:
```ts
import { useNotificationStore } from '@/store/notifications'

beforeEach(() => useNotificationStore.getState().clear())

test('push adds notification', () => {
  useNotificationStore.getState().push({ title: 'Test', body: 'Hello', kind: 'system' })
  expect(useNotificationStore.getState().notifications).toHaveLength(1)
})

test('dismiss removes by id', () => {
  useNotificationStore.getState().push({ title: 'A', body: 'B', kind: 'system' })
  const { id } = useNotificationStore.getState().notifications[0]
  useNotificationStore.getState().dismiss(id)
  expect(useNotificationStore.getState().notifications).toHaveLength(0)
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test -- --testPathPattern=notifications
```

- [ ] **Step 3: Implement notifications store**

Create `app/frontend/src/store/notifications.ts`:
```ts
import { create } from 'zustand'

export interface Notification {
  id: string
  title: string
  body: string
  kind: 'task' | 'friend' | 'system'
  createdAt: number
}

interface NotificationState {
  notifications: Notification[]
  push: (n: Omit<Notification, 'id' | 'createdAt'>) => void
  dismiss: (id: string) => void
  clear: () => void
}

let _id = 0
export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  push: (n) => set((s) => ({
    notifications: [...s.notifications, { ...n, id: String(++_id), createdAt: Date.now() }],
  })),
  dismiss: (id) => set((s) => ({ notifications: s.notifications.filter(n => n.id !== id) })),
  clear: () => set({ notifications: [] }),
}))
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test -- --testPathPattern=notifications
```

- [ ] **Step 5: Create NotificationToast**

Create `app/frontend/src/components/ui/NotificationToast.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNotificationStore } from '@/store/notifications'

const kindIcon = { task: '📋', friend: '👥', system: '🔔' }

export function NotificationToast() {
  const { notifications, dismiss } = useNotificationStore()

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (notifications.length === 0) return
    const latest = notifications[notifications.length - 1]
    const timer = setTimeout(() => dismiss(latest.id), 5000)
    return () => clearTimeout(timer)
  }, [notifications])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg max-w-xs"
            style={{ background: '#110820', border: '1px solid #b455ff55' }}
          >
            <span>{kindIcon[n.kind]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: '#e0d0ff' }}>{n.title}</p>
              {n.body && <p className="text-xs mt-0.5" style={{ color: '#776688' }}>{n.body}</p>}
            </div>
            <button onClick={() => dismiss(n.id)} className="text-xs opacity-40 hover:opacity-80 flex-shrink-0"
              style={{ color: '#776688' }}>✕</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 6: Add NotificationToast to dashboard layout**

Edit `app/frontend/app/(dashboard)/layout.tsx` — add `<NotificationToast />` before closing `</div>`:
```tsx
import { NotificationToast } from '@/components/ui/NotificationToast'
// ...inside layout:
<NotificationToast />
```

- [ ] **Step 7: Wire WS notifications to notification store**

Edit `app/frontend/src/lib/ws.ts` — inside `socket.onmessage`, add:
```ts
case 'notification':
  useNotificationStore.getState().push(payload)
  break
```
Add import: `import { useNotificationStore } from '@/store/notifications'`

- [ ] **Step 8: Commit**

```bash
git add app/frontend/src/store/notifications.ts app/frontend/src/components/ui/NotificationToast.tsx app/frontend/src/lib/ws.ts app/frontend/app/\(dashboard\)/layout.tsx
git commit -m "feat(app): notification store + animated toast + WS integration"
```

---

## Task 4: Settings Page

**Files:**
- Create: `app/frontend/src/store/settings.ts`
- Create: `app/frontend/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Implement settings store**

Create `app/frontend/src/store/settings.ts`:
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  serverURL: string
  aiEnabled: boolean
  setServerURL: (url: string) => void
  setAIEnabled: (enabled: boolean) => void
}

export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      serverURL: 'http://localhost:3005',
      aiEnabled: false,
      setServerURL: (serverURL) => set({ serverURL }),
      setAIEnabled: (aiEnabled) => set({ aiEnabled }),
    }),
    { name: 'astflye-settings' }
  )
)
```

- [ ] **Step 2: Update api.ts to use settings store**

Edit `app/frontend/src/lib/api.ts` — change `SERVER_URL` to use settings store:
```ts
import { useSettingsStore } from '@/store/settings'

// Change the SERVER_URL line to:
const SERVER_URL = () => useSettingsStore.getState().serverURL
// Update all usages of SERVER_URL to SERVER_URL()
```

- [ ] **Step 3: Create settings page**

Create `app/frontend/app/(dashboard)/settings/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { useMe } from '@/hooks/useMe'
import { useAuthStore } from '@/store/auth'

export default function SettingsPage() {
  const { serverURL, aiEnabled, setServerURL, setAIEnabled } = useSettingsStore()
  const { data: me } = useMe()
  const clearAuth = useAuthStore(s => s.clear)
  const [urlInput, setUrlInput] = useState(serverURL)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setServerURL(urlInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle = {
    background: '#1a0d2e', border: '1px solid #b455ff33',
    borderRadius: 8, padding: '8px 12px', color: '#e0d0ff', width: '100%',
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: '#b455ff' }}>Settings</h1>

      {/* Profile */}
      {me && (
        <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
          {me.avatar && <img src={me.avatar} className="w-12 h-12 rounded-full" alt={me.username} />}
          <div>
            <p className="font-medium" style={{ color: '#e0d0ff' }}>{me.username}</p>
            <p className="text-xs" style={{ color: '#554466' }}>Discord account</p>
          </div>
        </div>
      )}

      {/* Server URL */}
      <div className="p-4 rounded-xl space-y-3" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
        <h2 className="text-sm font-semibold" style={{ color: '#b455ff' }}>SERVER</h2>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>SERVER URL</label>
          <input style={inputStyle} value={urlInput} onChange={e => setUrlInput(e.target.value)} />
          <p className="text-xs mt-1" style={{ color: '#554466' }}>
            The address of your self-hosted Astflye server.
          </p>
        </div>
        <button onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: saved ? '#00cc7733' : '#b455ff33', border: `1px solid ${saved ? '#00cc77' : '#b455ff55'}`, color: saved ? '#00cc77' : '#e0d0ff' }}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {/* AI Assistant */}
      <div className="p-4 rounded-xl space-y-3" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
        <h2 className="text-sm font-semibold" style={{ color: '#b455ff' }}>ASSISTANT</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm" style={{ color: '#e0d0ff' }}>AI-powered mode</p>
            <p className="text-xs" style={{ color: '#554466' }}>
              Requires CLAUDE_API_KEY in server .env
            </p>
          </div>
          <button
            onClick={() => setAIEnabled(!aiEnabled)}
            className="w-12 h-6 rounded-full transition-all relative"
            style={{ background: aiEnabled ? '#b455ff' : '#1a0d2e', border: '1px solid #b455ff33' }}>
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: aiEnabled ? '1.4rem' : '0.1rem' }} />
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="p-4 rounded-xl" style={{ background: '#110820', border: '1px solid #ff55aa22' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#ff55aa' }}>ACCOUNT</h2>
        <button
          onClick={() => {
            clearAuth()
            window.location.href = '/login'
          }}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ background: '#ff55aa22', border: '1px solid #ff55aa44', color: '#ff55aa' }}>
          Logout
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/frontend/src/store/settings.ts app/frontend/app/\(dashboard\)/settings/
git commit -m "feat(app): settings page — server URL, AI toggle, logout"
```

---

## Task 5: README + .env.example + Final Cleanup

- [ ] **Step 1: Create README.md**

Create `README.md`:
```markdown
# Astflye Life

A self-hosted desktop productivity and life management app. Organize tasks, track finances, and chat with friends — gated by Discord server membership.

## Stack
- **Server:** Go + Fiber + GORM + SQLite
- **Desktop:** Wails v2 + Next.js 14 + Tailwind CSS
- **Auth:** Discord OAuth2 + JWT

## Prerequisites
- Go 1.22+
- Node.js 20+
- Wails v2: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Discord app configured at https://discord.com/developers/applications

## Quick Start

### 1. Clone & configure
```bash
git clone <repo-url>
cd astflye-life
cp .env.example server/.env
# Edit server/.env with your Discord credentials and secrets
```

### 2. Register Discord redirect URI
In Discord Developer Portal → your app → OAuth2 → Redirects:
Add `http://localhost:3005/auth/callback`

### 3. Start the server
```bash
cd server
go run .
```

### 4. Run the desktop app (dev mode)
```bash
cd app
wails dev
```

### 5. Build desktop app
```bash
cd app
wails build
```

## Environment Variables
See `.env.example` for all required variables.

## Project Structure
```
server/    Go API server (runs 24/7)
app/       Wails desktop client
shared/    Shared Go types
docs/      Specs and implementation plans
```
```

- [ ] **Step 2: Ensure .env.example is complete**

Verify `server/.env.example` matches all variables in `server/config/config.go`.

- [ ] **Step 3: Add .superpowers/ to .gitignore if not present**

```bash
grep -q ".superpowers" .gitignore || echo ".superpowers/" >> .gitignore
```

- [ ] **Step 4: Run full test suite one final time**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./... -v
cd "c:/! A1/Astflye Organize/app/frontend" && npm test
cd "c:/! A1/Astflye Organize/app/frontend" && npm run build
```
All tests must pass, build must succeed.

- [ ] **Step 5: Final Phase 4 commit**

```bash
cd "c:/! A1/Astflye Organize"
git add README.md .gitignore
git commit -m "feat: Phase 4 complete — assistant, notifications, settings, README"
```

- [ ] **Step 6: Push to GitHub**

```bash
cd "c:/! A1/Astflye Organize"
git push origin main
```

---

## Post-Phase 4 Checklist

Before calling MVP done, verify:

- [ ] Server starts cleanly with valid `.env`
- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] Login with Discord → guild check → JWT → app dashboard
- [ ] Create a task, mark it complete, streak increments
- [ ] Add a transaction, check summary widget on dashboard
- [ ] Send a friend request, accept it, open chat, send a message
- [ ] `POST /assistant/nudge` returns a motivational message
- [ ] Settings page saves server URL and persists after restart
- [ ] All 11 security checklist items from the spec are verified
