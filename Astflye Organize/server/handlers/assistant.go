package handlers

import (
	"fmt"
	"strings"
	"time"

	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type AssistantHandler struct{ db *gorm.DB }

func NewAssistantHandler(db *gorm.DB) *AssistantHandler { return &AssistantHandler{db: db} }

type assistantReply struct {
	Message string `json:"message"`
	Type    string `json:"type"` // "info" | "tip" | "warning"
}

func (h *AssistantHandler) Ask(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var body struct {
		Query string `json:"query"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Query) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "query required"})
	}
	q := strings.ToLower(strings.TrimSpace(body.Query))

	var user models.User
	h.db.First(&user, "id = ?", userID)

	today := time.Now().Truncate(24 * time.Hour)
	var pendingCount int64
	h.db.Model(&models.Task{}).
		Where("user_id = ? AND status = ? AND recurrence = ? AND created_at >= ?",
			userID, "pending", "daily", today).
		Count(&pendingCount)

	return c.JSON(matchQuery(q, &user, pendingCount))
}

func matchQuery(q string, user *models.User, pending int64) assistantReply {
	switch {
	case contains(q, "streak", "sequência"):
		if user.CurrentStreak == 0 {
			return assistantReply{"Start completing daily tasks to build your streak!", "tip"}
		}
		return assistantReply{
			fmt.Sprintf("You're on a %d-day streak! Keep it up — your best is %d days.", user.CurrentStreak, user.LongestStreak),
			"info",
		}
	case contains(q, "task", "tarefa", "todo"):
		if pending > 0 {
			return assistantReply{fmt.Sprintf("You have %d pending task(s) today. Let's crush them!", pending), "tip"}
		}
		return assistantReply{"All daily tasks done! You're killing it today.", "info"}
	case contains(q, "finance", "money", "dinheiro", "grana"):
		return assistantReply{"Check the Finance tab for your income/expense breakdown and monthly balance.", "info"}
	case contains(q, "team", "chat", "social"):
		return assistantReply{"Head to the Social tab to join a team and chat with your crew.", "tip"}
	case contains(q, "help", "ajuda", "como"):
		return assistantReply{"I can answer questions about your streak, tasks, finance, or social. Try asking about any of those!", "info"}
	default:
		return assistantReply{"I'm not sure about that yet. Try asking about your tasks, streak, or finances.", "tip"}
	}
}

func contains(s string, keywords ...string) bool {
	for _, k := range keywords {
		if strings.Contains(s, k) {
			return true
		}
	}
	return false
}
