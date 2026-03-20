package handlers

import (
	"encoding/json"
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/astflye/life/server/models"
)

type SocialHandler struct{ db *gorm.DB }

func NewSocialHandler(db *gorm.DB) *SocialHandler { return &SocialHandler{db: db} }

// ---- Friendships ----

func (h *SocialHandler) SendFriendRequest(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body struct {
		ToUserID string `json:"to_user_id"`
	}
	if err := c.BodyParser(&body); err != nil || body.ToUserID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "to_user_id required"})
	}

	// check no existing friendship
	var existing models.Friendship
	if err := h.db.Where(
		"(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, body.ToUserID, body.ToUserID, userID,
	).First(&existing).Error; err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "friendship already exists"})
	}

	f := models.Friendship{
		UserID:   userID,
		FriendID: body.ToUserID,
		Status:   "pending",
	}
	if err := h.db.Create(&f).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(f)
}

func (h *SocialHandler) RespondToFriendRequest(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	id := c.Params("id")
	var body struct {
		Accept bool `json:"accept"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	var f models.Friendship
	if err := h.db.Where("id = ? AND friend_id = ? AND status = ?", id, userID, "pending").First(&f).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "request not found"})
	}
	if body.Accept {
		f.Status = "accepted"
		h.db.Save(&f)
	} else {
		h.db.Delete(&f)
	}
	return c.JSON(fiber.Map{"status": f.Status})
}

func (h *SocialHandler) ListFriends(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var friendships []models.Friendship
	h.db.Where(
		"(user_id = ? OR friend_id = ?) AND status = ?", userID, userID, "accepted",
	).Find(&friendships)
	return c.JSON(friendships)
}

// ---- Teams ----

func (h *SocialHandler) CreateTeam(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&body); err != nil || body.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name required"})
	}
	team := models.Team{Name: body.Name, Description: body.Description, OwnerID: userID}
	if err := h.db.Create(&team).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	// owner is automatically a member
	h.db.Create(&models.TeamMember{TeamID: team.ID, UserID: userID, Role: "owner"})
	return c.Status(201).JSON(team)
}

func (h *SocialHandler) ListTeams(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var memberships []models.TeamMember
	h.db.Where("user_id = ?", userID).Find(&memberships)

	teamIDs := make([]string, 0, len(memberships))
	for _, m := range memberships {
		teamIDs = append(teamIDs, m.TeamID)
	}
	var teams []models.Team
	if len(teamIDs) > 0 {
		h.db.Where("id IN ?", teamIDs).Find(&teams)
	}
	return c.JSON(teams)
}

func (h *SocialHandler) InviteToTeam(c *fiber.Ctx) error {
	teamID := c.Params("id")
	var body struct {
		UserID string `json:"user_id"`
	}
	if err := c.BodyParser(&body); err != nil || body.UserID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "user_id required"})
	}
	m := models.TeamMember{TeamID: teamID, UserID: body.UserID, Role: "member"}
	if err := h.db.Create(&m).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(m)
}

// ---- Messages (REST history) ----

func (h *SocialHandler) GetMessages(c *fiber.Ctx) error {
	teamID := c.Params("id")
	var msgs []models.Message
	h.db.Where("team_id = ?", teamID).Order("created_at asc").Limit(100).Find(&msgs)
	return c.JSON(msgs)
}

// ---- WebSocket ----

type wsMessage struct {
	Type    string `json:"type"`    // "chat" | "ping"
	TeamID  string `json:"team_id"`
	Content string `json:"content"`
}

type wsEvent struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

func (h *SocialHandler) HandleWS(c *websocket.Conn) {
	userID := c.Locals("userID").(string)
	teamID := c.Query("team_id")

	client := &Client{
		conn:   c,
		userID: userID,
		teamID: teamID,
		send:   make(chan []byte, 64),
	}
	GlobalHub.Register(client)
	defer GlobalHub.Unregister(client)

	// writer goroutine
	go func() {
		for msg := range client.send {
			if err := c.WriteMessage(websocket.TextMessage, msg); err != nil {
				break
			}
		}
	}()

	// reader loop
	for {
		_, raw, err := c.ReadMessage()
		if err != nil {
			break
		}
		var in wsMessage
		if err := json.Unmarshal(raw, &in); err != nil {
			continue
		}
		if in.Type == "ping" {
			out, _ := json.Marshal(wsEvent{Type: "pong"})
			client.send <- out
			continue
		}
		if in.Type == "chat" && in.TeamID != "" && in.Content != "" {
			msg := models.Message{
				TeamID:    in.TeamID,
				SenderID:  userID,
				Content:   in.Content,
				CreatedAt: time.Now(),
			}
			h.db.Create(&msg)
			out, _ := json.Marshal(wsEvent{Type: "chat", Payload: msg})
			GlobalHub.BroadcastToRoom(in.TeamID, out)
		}
	}
}
