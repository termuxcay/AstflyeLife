package handlers

import (
	"sync"

	"github.com/gofiber/websocket/v2"
)

// Client represents a connected WebSocket client.
type Client struct {
	conn   *websocket.Conn
	userID string
	teamID string // empty if not in a team room
	send   chan []byte
}

// Hub manages all active WebSocket clients and broadcasts messages.
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}
}

var GlobalHub = &Hub{
	clients: make(map[*Client]struct{}),
}

func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
	close(c.send)
}

// BroadcastToRoom sends a message to all clients in a team room.
func (h *Hub) BroadcastToRoom(teamID string, msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c.teamID == teamID {
			select {
			case c.send <- msg:
			default:
			}
		}
	}
}

// BroadcastToUser sends a message to a specific user (all their connections).
func (h *Hub) BroadcastToUser(userID string, msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c.userID == userID {
			select {
			case c.send <- msg:
			default:
			}
		}
	}
}
