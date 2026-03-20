# Astflye Life — Phase 3: Social System + Real-time Chat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the friend system (add by Discord ID, accept/block), team system (create, add members), WebSocket hub for real-time chat, and a Social page with presence indicators.

**Architecture:** WebSocket hub manages all live connections. Messages are persisted to SQLite. Presence (online/offline) is tracked in-memory on the server. The frontend uses a single persistent WebSocket connection managed by `ws.ts`.

**Tech Stack:** gorilla/websocket (server), Go channels for hub, native WebSocket API (frontend), Zustand for message state

**Prerequisite:** Phase 2 complete.

---

## File Map

### Server
| File | Responsibility |
|---|---|
| `server/ws/hub.go` | Connection registry, broadcast, presence tracking |
| `server/ws/client.go` | Per-connection reader/writer goroutines |
| `server/handlers/social.go` | Friend + team REST handlers |
| `server/handlers/chat.go` | WebSocket upgrade + message persistence |
| `server/main.go` | Register social + WS routes |

### Frontend
| File | Responsibility |
|---|---|
| `app/frontend/src/lib/ws.ts` | WebSocket client singleton + event emitter |
| `app/frontend/src/store/chat.ts` | Zustand store for messages + presence |
| `app/frontend/src/hooks/useSocial.ts` | TanStack Query hooks for friends + teams |
| `app/frontend/src/app/(dashboard)/social/page.tsx` | Social hub page |
| `app/frontend/src/components/social/FriendCard.tsx` | Friend list item with presence dot |
| `app/frontend/src/components/social/ChatPanel.tsx` | Chat panel with message input |

---

## Task 1: WebSocket Hub (Server)

**Files:**
- Create: `server/ws/hub.go`
- Create: `server/ws/client.go`
- Test: `server/ws/hub_test.go`

- [ ] **Step 1: Write failing test**

Create `server/ws/hub_test.go`:
```go
package ws_test

import (
	"testing"
	"github.com/astflye/life/server/ws"
)

func TestHub_RegisterAndUnregister(t *testing.T) {
	hub := ws.NewHub()
	go hub.Run()

	client := &ws.Client{UserID: "user-1", Hub: hub, Send: make(chan []byte, 10)}
	hub.Register <- client

	// Give hub goroutine time to process
	for i := 0; i < 100; i++ {
		if hub.IsOnline("user-1") {
			break
		}
	}
	if !hub.IsOnline("user-1") {
		t.Error("expected user-1 to be online after register")
	}

	hub.Unregister <- client
	for i := 0; i < 100; i++ {
		if !hub.IsOnline("user-1") {
			break
		}
	}
	if hub.IsOnline("user-1") {
		t.Error("expected user-1 to be offline after unregister")
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./ws/... -v
```

- [ ] **Step 3: Implement ws/hub.go**

Create `server/ws/hub.go`:
```go
package ws

import (
	"encoding/json"
	"sync"
)

// Message is the typed JSON envelope for all WebSocket messages.
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type Hub struct {
	clients    map[string]*Client // userID → client
	mu         sync.RWMutex
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *DirectMessage
}

type DirectMessage struct {
	To      string
	Payload []byte
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		Register:   make(chan *Client, 16),
		Unregister: make(chan *Client, 16),
		Broadcast:  make(chan *DirectMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client.UserID] = client
			h.mu.Unlock()
			h.notifyPresence(client.UserID, true)

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.UserID]; ok {
				delete(h.clients, client.UserID)
				close(client.Send)
			}
			h.mu.Unlock()
			h.notifyPresence(client.UserID, false)

		case dm := <-h.Broadcast:
			h.mu.RLock()
			if c, ok := h.clients[dm.To]; ok {
				select {
				case c.Send <- dm.Payload:
				default:
					// client send buffer full — drop
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) IsOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

func (h *Hub) SendTo(userID string, msgType string, payload interface{}) {
	data, _ := json.Marshal(payload)
	msg := Message{Type: msgType, Payload: data}
	envelope, _ := json.Marshal(msg)
	h.Broadcast <- &DirectMessage{To: userID, Payload: envelope}
}

func (h *Hub) notifyPresence(userID string, online bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	eventType := "presence.online"
	if !online {
		eventType = "presence.offline"
	}
	payload, _ := json.Marshal(map[string]string{"userId": userID})
	msg := Message{Type: eventType, Payload: payload}
	envelope, _ := json.Marshal(msg)
	for _, c := range h.clients {
		select {
		case c.Send <- envelope:
		default:
		}
	}
}
```

Create `server/ws/client.go`:
```go
package ws

import (
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = 50 * time.Second
	maxMsgSize = 4096
)

type Client struct {
	UserID  string
	Hub     *Hub
	Conn    *websocket.Conn
	Send    chan []byte
	OnMessage func(userID string, msg []byte)
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	c.Conn.SetReadLimit(maxMsgSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, msg, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		if c.OnMessage != nil {
			c.OnMessage(c.UserID, msg)
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.Conn.WriteMessage(websocket.TextMessage, msg)
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./ws/... -v
```

- [ ] **Step 5: Commit**

```bash
git add server/ws/
git commit -m "feat(server): WebSocket hub + client read/write pumps + presence tracking"
```

---

## Task 2: Social + Chat Handlers (Server)

**Files:**
- Create: `server/handlers/social.go`
- Create: `server/handlers/chat.go`
- Test: `server/handlers/social_test.go`

- [ ] **Step 1: Write failing tests**

Create `server/handlers/social_test.go`:
```go
package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/astflye/life/server/db"
	"github.com/astflye/life/server/handlers"
	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func setupSocialApp(t *testing.T) (*fiber.App, string, string) {
	t.Helper()
	database, _ := db.Init(":memory:")
	userID := uuid.New().String()
	friendDiscordID := "disc-friend-999"
	database.Create(&models.User{ID: userID, DiscordID: "disc-me", Username: "Me"})
	database.Create(&models.User{ID: uuid.New().String(), DiscordID: friendDiscordID, Username: "Friend"})

	app := fiber.New()
	h := handlers.NewSocialHandler(database)
	app.Use(func(c *fiber.Ctx) error { c.Locals("userID", userID); return c.Next() })
	app.Get("/social/friends", h.ListFriends)
	app.Post("/social/friends", h.SendFriendRequest)
	app.Patch("/social/friends/:id", h.UpdateFriendship)
	app.Get("/social/teams", h.ListTeams)
	app.Post("/social/teams", h.CreateTeam)
	app.Post("/social/teams/:id/members", h.AddTeamMember)
	return app, userID, friendDiscordID
}

func TestSendFriendRequest(t *testing.T) {
	app, _, friendDiscordID := setupSocialApp(t)
	body, _ := json.Marshal(map[string]string{"discord_id": friendDiscordID})
	req := httptest.NewRequest("POST", "/social/friends", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	if resp.StatusCode != 201 {
		t.Errorf("expected 201, got %d", resp.StatusCode)
	}
}

func TestCreateTeam(t *testing.T) {
	app, _, _ := setupSocialApp(t)
	body, _ := json.Marshal(map[string]string{"name": "Dream Team"})
	req := httptest.NewRequest("POST", "/social/teams", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	if resp.StatusCode != 201 {
		t.Errorf("expected 201, got %d", resp.StatusCode)
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -run TestSendFriend -run TestCreateTeam -v
```

- [ ] **Step 3: Implement social.go**

Create `server/handlers/social.go`:
```go
package handlers

import (
	"time"

	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SocialHandler struct{ db *gorm.DB }

func NewSocialHandler(db *gorm.DB) *SocialHandler { return &SocialHandler{db: db} }

func (h *SocialHandler) ListFriends(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var friendships []models.Friendship
	h.db.Where("(user_id = ? OR friend_id = ?) AND status = 'accepted'", userID, userID).Find(&friendships)
	return c.JSON(friendships)
}

func (h *SocialHandler) SendFriendRequest(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body struct{ DiscordID string `json:"discord_id"` }
	if err := c.BodyParser(&body); err != nil || body.DiscordID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "discord_id required"})
	}
	var target models.User
	if err := h.db.Where("discord_id = ?", body.DiscordID).First(&target).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found — they must log in first"})
	}
	if target.ID == userID {
		return c.Status(400).JSON(fiber.Map{"error": "cannot add yourself"})
	}
	// Check not already friends
	var existing models.Friendship
	if err := h.db.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, target.ID, target.ID, userID).First(&existing).Error; err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "friendship already exists"})
	}
	f := models.Friendship{
		ID: uuid.New().String(), UserID: userID, FriendID: target.ID,
		Status: "pending", CreatedAt: time.Now(),
	}
	h.db.Create(&f)
	return c.Status(201).JSON(f)
}

func (h *SocialHandler) UpdateFriendship(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body struct{ Status string `json:"status"` }
	c.BodyParser(&body)
	if body.Status != "accepted" && body.Status != "blocked" {
		return c.Status(400).JSON(fiber.Map{"error": "status must be accepted or blocked"})
	}
	var f models.Friendship
	if err := h.db.Where("id = ? AND friend_id = ?", c.Params("id"), userID).First(&f).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "friendship not found"})
	}
	h.db.Model(&f).Update("status", body.Status)
	return c.JSON(f)
}

func (h *SocialHandler) ListTeams(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var memberRows []models.TeamMember
	h.db.Where("user_id = ?", userID).Find(&memberRows)
	teamIDs := make([]string, len(memberRows))
	for i, m := range memberRows {
		teamIDs[i] = m.TeamID
	}
	var teams []models.Team
	if len(teamIDs) > 0 {
		h.db.Where("id IN ?", teamIDs).Find(&teams)
	}
	return c.JSON(teams)
}

func (h *SocialHandler) CreateTeam(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body struct{ Name string `json:"name"` }
	if err := c.BodyParser(&body); err != nil || body.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name required"})
	}
	team := models.Team{ID: uuid.New().String(), Name: body.Name, OwnerID: userID, CreatedAt: time.Now()}
	h.db.Create(&team)
	h.db.Create(&models.TeamMember{TeamID: team.ID, UserID: userID, Role: "admin", JoinedAt: time.Now()})
	return c.Status(201).JSON(team)
}

func (h *SocialHandler) AddTeamMember(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	teamID := c.Params("id")
	var team models.Team
	if err := h.db.Where("id = ? AND owner_id = ?", teamID, userID).First(&team).Error; err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "only team owner can add members"})
	}
	var body struct{ UserID string `json:"user_id"` }
	if err := c.BodyParser(&body); err != nil || body.UserID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "user_id required"})
	}
	member := models.TeamMember{TeamID: teamID, UserID: body.UserID, Role: "member", JoinedAt: time.Now()}
	h.db.Create(&member)
	return c.Status(201).JSON(member)
}
```

- [ ] **Step 4: Create chat.go (WebSocket upgrade)**

Create `server/handlers/chat.go`:
```go
package handlers

import (
	"encoding/json"
	"time"

	"github.com/astflye/life/server/models"
	"github.com/astflye/life/server/ws"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type ChatHandler struct {
	db  *gorm.DB
	hub *ws.Hub
}

func NewChatHandler(db *gorm.DB, hub *ws.Hub) *ChatHandler {
	return &ChatHandler{db: db, hub: hub}
}

func (h *ChatHandler) HandleWS(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(c.Context(), c.Context().Response.BodyWriter(), nil)
	if err != nil {
		return err
	}

	client := &ws.Client{
		UserID: userID,
		Hub:    h.hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
	}
	client.OnMessage = func(senderID string, raw []byte) {
		var msg ws.Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			return
		}
		switch msg.Type {
		case "message.send":
			var payload struct {
				To       string `json:"to"`
				ChatType string `json:"chat_type"`
				Content  string `json:"content"`
			}
			json.Unmarshal(msg.Payload, &payload)
			if payload.Content == "" || payload.To == "" {
				return
			}
			// Persist message
			m := models.Message{
				ID: uuid.New().String(), SenderID: senderID,
				ReceiverID: payload.To, ChatType: payload.ChatType,
				Content: payload.Content, CreatedAt: time.Now(),
			}
			h.db.Create(&m)
			// Forward to recipient
			h.hub.SendTo(payload.To, "message.receive", map[string]interface{}{
				"from": senderID, "chat_type": payload.ChatType,
				"content": payload.Content, "created_at": m.CreatedAt,
			})
		case "ping":
			client.Send <- []byte(`{"type":"pong","payload":{}}`)
		}
	}

	h.hub.Register <- client
	go client.WritePump()
	go client.ReadPump()
	return nil
}
```

Note: add `"net/http"` import to chat.go since upgrader uses it.

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -run TestSendFriend -run TestCreateTeam -v
```

- [ ] **Step 6: Register social + WS routes in main.go**

Add to `server/main.go`:
```go
hub := ws.NewHub()
go hub.Run()

socialHandler := handlers.NewSocialHandler(database)
api.Get("/social/friends", socialHandler.ListFriends)
api.Post("/social/friends", socialHandler.SendFriendRequest)
api.Patch("/social/friends/:id", socialHandler.UpdateFriendship)
api.Get("/social/teams", socialHandler.ListTeams)
api.Post("/social/teams", socialHandler.CreateTeam)
api.Post("/social/teams/:id/members", socialHandler.AddTeamMember)

chatHandler := handlers.NewChatHandler(database, hub)
api.Get("/ws", chatHandler.HandleWS)
```

- [ ] **Step 7: Commit**

```bash
git add server/handlers/social.go server/handlers/social_test.go server/handlers/chat.go server/main.go
git commit -m "feat(server): social (friends + teams) + WebSocket chat handler"
```

---

## Task 3: WebSocket Client + Chat Store (Frontend)

**Files:**
- Create: `app/frontend/src/lib/ws.ts`
- Create: `app/frontend/src/store/chat.ts`

- [ ] **Step 1: Write failing test for chat store**

Create `app/frontend/src/__tests__/chat-store.test.ts`:
```ts
import { useChatStore } from '@/store/chat'

beforeEach(() => useChatStore.getState().clear())

test('addMessage appends to thread', () => {
  useChatStore.getState().addMessage({
    from: 'user-1', to: 'user-2', chatType: 'direct',
    content: 'Hello!', createdAt: new Date().toISOString(),
  })
  const msgs = useChatStore.getState().getThread('user-1', 'user-2')
  expect(msgs).toHaveLength(1)
  expect(msgs[0].content).toBe('Hello!')
})

test('setOnline + setOffline updates presence', () => {
  useChatStore.getState().setOnline('user-1')
  expect(useChatStore.getState().online.has('user-1')).toBe(true)
  useChatStore.getState().setOffline('user-1')
  expect(useChatStore.getState().online.has('user-1')).toBe(false)
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test -- --testPathPattern=chat-store
```

- [ ] **Step 3: Implement chat store**

Create `app/frontend/src/store/chat.ts`:
```ts
import { create } from 'zustand'

interface ChatMessage {
  from: string
  to: string
  chatType: 'direct' | 'team'
  content: string
  createdAt: string
}

interface ChatState {
  messages: ChatMessage[]
  online: Set<string>
  addMessage: (msg: ChatMessage) => void
  setOnline: (userId: string) => void
  setOffline: (userId: string) => void
  getThread: (a: string, b: string) => ChatMessage[]
  clear: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  online: new Set(),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setOnline: (userId) => set((s) => ({ online: new Set([...s.online, userId]) })),
  setOffline: (userId) => set((s) => {
    const n = new Set(s.online)
    n.delete(userId)
    return { online: n }
  }),
  getThread: (a, b) => get().messages.filter(
    m => (m.from === a && m.to === b) || (m.from === b && m.to === a)
  ),
  clear: () => set({ messages: [], online: new Set() }),
}))
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test -- --testPathPattern=chat-store
```

- [ ] **Step 5: Implement ws.ts**

Create `app/frontend/src/lib/ws.ts`:
```ts
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'

const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3005').replace('http', 'ws')

let socket: WebSocket | null = null

export function connectWS() {
  if (socket?.readyState === WebSocket.OPEN) return
  const token = useAuthStore.getState().accessToken
  if (!token) return

  socket = new WebSocket(`${SERVER_URL}/ws?token=${token}`)

  socket.onmessage = (event) => {
    try {
      const { type, payload } = JSON.parse(event.data)
      const store = useChatStore.getState()
      switch (type) {
        case 'message.receive':
          store.addMessage(payload)
          break
        case 'presence.online':
          store.setOnline(payload.userId)
          break
        case 'presence.offline':
          store.setOffline(payload.userId)
          break
      }
    } catch {}
  }

  socket.onclose = () => {
    socket = null
    // reconnect after 3s
    setTimeout(connectWS, 3000)
  }
}

export function sendChatMessage(to: string, chatType: 'direct' | 'team', content: string) {
  if (socket?.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify({
    type: 'message.send',
    payload: { to, chatType, content },
  }))
}

export function disconnectWS() {
  socket?.close()
  socket = null
}
```

- [ ] **Step 6: Connect WS on auth success**

Edit `app/frontend/src/app/(dashboard)/layout.tsx` — add WS connection on mount:
```tsx
'use client'
import { useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { connectWS } from '@/lib/ws'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => { connectWS() }, [])
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

- [ ] **Step 7: Commit**

```bash
git add app/frontend/src/lib/ws.ts app/frontend/src/store/chat.ts app/frontend/app/\(dashboard\)/layout.tsx
git commit -m "feat(app): WebSocket client + chat store + auto-connect on dashboard"
```

---

## Task 4: Social UI Page

**Files:**
- Create: `app/frontend/src/hooks/useSocial.ts`
- Create: `app/frontend/src/components/social/FriendCard.tsx`
- Create: `app/frontend/src/components/social/ChatPanel.tsx`
- Create: `app/frontend/src/app/(dashboard)/social/page.tsx`

- [ ] **Step 1: Create social hooks**

Create `app/frontend/src/hooks/useSocial.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface Friendship {
  id: string
  user_id: string
  friend_id: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
}

export function useFriends() {
  return useQuery<Friendship[]>({
    queryKey: ['friends'],
    queryFn: () => apiFetch('/social/friends'),
  })
}

export function useSendFriendRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (discordId: string) =>
      apiFetch('/social/friends', { method: 'POST', body: JSON.stringify({ discord_id: discordId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  })
}

export function useUpdateFriendship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/social/friends/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  })
}
```

- [ ] **Step 2: Create FriendCard component**

Create `app/frontend/src/components/social/FriendCard.tsx`:
```tsx
'use client'
import { useChatStore } from '@/store/chat'

interface Props {
  userId: string
  username: string
  avatar?: string
  status: string
  onChat: (userId: string) => void
}

export function FriendCard({ userId, username, avatar, status, onChat }: Props) {
  const online = useChatStore(s => s.online.has(userId))
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:opacity-80 transition-all"
      style={{ background: '#110820', border: '1px solid #b455ff22' }}
      onClick={() => status === 'accepted' && onChat(userId)}>
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
          style={{ background: '#1a0d2e', border: '1px solid #b455ff33' }}>
          {avatar ? <img src={avatar} className="w-full h-full rounded-full" alt={username} /> : username[0].toUpperCase()}
        </div>
        {status === 'accepted' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ background: online ? '#00cc77' : '#444', borderColor: '#08050f' }} />
        )}
      </div>
      {/* Info */}
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: '#e0d0ff' }}>{username}</p>
        <p className="text-xs" style={{ color: status === 'pending' ? '#b455ff' : online ? '#00cc77' : '#554466' }}>
          {status === 'pending' ? 'pending request' : online ? 'online' : 'offline'}
        </p>
      </div>
      {status === 'accepted' && (
        <span className="text-xs" style={{ color: '#554466' }}>💬</span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create ChatPanel**

Create `app/frontend/src/components/social/ChatPanel.tsx`:
```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chat'
import { sendChatMessage } from '@/lib/ws'
import { useMe } from '@/hooks/useMe'

interface Props {
  targetUserId: string
  targetUsername: string
  onClose: () => void
}

export function ChatPanel({ targetUserId, targetUsername, onClose }: Props) {
  const { data: me } = useMe()
  const messages = useChatStore(s => me ? s.getThread(me.id, targetUserId) : [])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    if (!input.trim()) return
    sendChatMessage(targetUserId, 'direct', input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d0818' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid #b455ff22' }}>
        <span className="text-sm font-medium" style={{ color: '#e0d0ff' }}>{targetUsername}</span>
        <button onClick={onClose} className="text-xs opacity-40 hover:opacity-80" style={{ color: '#776688' }}>✕</button>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
        {messages.map((msg, i) => {
          const mine = msg.from === me?.id
          return (
            <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-xs px-3 py-2 rounded-xl text-sm"
                style={{
                  background: mine ? 'linear-gradient(135deg, #b455ff, #ff55aa)' : '#1a0d2e',
                  color: '#e0d0ff',
                }}>
                {msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <div className="p-3 flex gap-2" style={{ borderTop: '1px solid #b455ff22' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message..."
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: '#1a0d2e', border: '1px solid #b455ff33', color: '#e0d0ff' }}
        />
        <button onClick={send}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)', color: 'white' }}>
          →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create social page**

Create `app/frontend/app/(dashboard)/social/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useFriends, useSendFriendRequest } from '@/hooks/useSocial'
import { useMe } from '@/hooks/useMe'
import { FriendCard } from '@/components/social/FriendCard'
import { ChatPanel } from '@/components/social/ChatPanel'

export default function SocialPage() {
  const { data: me } = useMe()
  const { data: friends } = useFriends()
  const sendRequest = useSendFriendRequest()
  const [discordInput, setDiscordInput] = useState('')
  const [chatTarget, setChatTarget] = useState<{ id: string; username: string } | null>(null)

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!discordInput.trim()) return
    await sendRequest.mutateAsync(discordInput.trim())
    setDiscordInput('')
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left: friend list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <h1 className="text-xl font-bold" style={{ color: '#b455ff' }}>Social</h1>

        {/* Add friend */}
        <form onSubmit={handleAddFriend} className="flex gap-2">
          <input
            value={discordInput}
            onChange={e => setDiscordInput(e.target.value)}
            placeholder="Discord ID..."
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#110820', border: '1px solid #b455ff33', color: '#e0d0ff' }}
          />
          <button type="submit" className="px-3 py-2 rounded-lg text-sm"
            style={{ background: '#b455ff33', border: '1px solid #b455ff55', color: '#e0d0ff' }}>
            +
          </button>
        </form>

        <div className="flex flex-col gap-2">
          {friends?.map(f => {
            const otherId = f.user_id === me?.id ? f.friend_id : f.user_id
            return (
              <FriendCard
                key={f.id}
                userId={otherId}
                username={otherId} // TODO: enrich with user lookup
                status={f.status}
                onChat={(id) => setChatTarget({ id, username: otherId })}
              />
            )
          })}
          {friends?.length === 0 && (
            <p className="text-xs text-center py-6" style={{ color: '#554466' }}>
              No friends yet. Add one by Discord ID.
            </p>
          )}
        </div>
      </div>

      {/* Right: chat panel */}
      <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #b455ff22' }}>
        {chatTarget ? (
          <ChatPanel
            targetUserId={chatTarget.id}
            targetUsername={chatTarget.username}
            onClose={() => setChatTarget(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: '#554466' }}>Select a friend to chat</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Build + commit**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm run build
cd "c:/! A1/Astflye Organize"
git add app/frontend/src/hooks/useSocial.ts app/frontend/src/components/social/ app/frontend/app/\(dashboard\)/social/
git commit -m "feat(app): social page + friend cards + chat panel with presence dots"
```

- [ ] **Step 6: Run all tests**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./... -v
cd "c:/! A1/Astflye Organize/app/frontend" && npm test
```

- [ ] **Step 7: Phase 3 final commit**

```bash
cd "c:/! A1/Astflye Organize"
git add .
git commit -m "feat: Phase 3 complete — friends, teams, real-time chat, presence indicators"
```
