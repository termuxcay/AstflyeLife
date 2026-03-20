package handlers

import (
	"time"

	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FinanceHandler struct{ db *gorm.DB }

func NewFinanceHandler(db *gorm.DB) *FinanceHandler { return &FinanceHandler{db: db} }

func (h *FinanceHandler) ListTransactions(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	query := h.db.Where("user_id = ?", userID)
	if t := c.Query("type"); t != "" {
		query = query.Where("type = ?", t)
	}
	if cat := c.Query("category"); cat != "" {
		query = query.Where("category = ?", cat)
	}
	var txs []models.Transaction
	query.Order("date desc").Find(&txs)
	return c.JSON(txs)
}

func (h *FinanceHandler) CreateTransaction(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body models.Transaction
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.Type == "" || body.Amount <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "type and amount required"})
	}
	body.ID = uuid.New().String()
	body.UserID = userID
	if body.Currency == "" {
		body.Currency = "BRL"
	}
	if body.Date.IsZero() {
		body.Date = time.Now()
	}
	body.CreatedAt = time.Now()
	h.db.Create(&body)
	return c.Status(201).JSON(body)
}

func (h *FinanceHandler) UpdateTransaction(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var tx models.Transaction
	if err := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).First(&tx).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "transaction not found"})
	}
	var updates models.Transaction
	c.BodyParser(&updates)
	h.db.Model(&tx).Updates(updates)
	return c.JSON(tx)
}

func (h *FinanceHandler) DeleteTransaction(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	result := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).Delete(&models.Transaction{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *FinanceHandler) Summary(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	period := c.Query("period", "monthly")
	now := time.Now()

	baseQuery := h.db.Model(&models.Transaction{}).Where("user_id = ?", userID)
	switch period {
	case "daily":
		baseQuery = baseQuery.Where("date >= ?", now.Truncate(24*time.Hour))
	case "weekly":
		baseQuery = baseQuery.Where("date >= ?", now.AddDate(0, 0, -7))
	case "monthly":
		baseQuery = baseQuery.Where("date >= ?", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local))
	case "yearly":
		baseQuery = baseQuery.Where("date >= ?", time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.Local))
	// "all" — no date filter
	}

	var income, expenses float64
	baseQuery.Session(&gorm.Session{}).Where("type = ?", "income").Select("COALESCE(SUM(amount), 0)").Scan(&income)
	baseQuery.Session(&gorm.Session{}).Where("type = ?", "expense").Select("COALESCE(SUM(amount), 0)").Scan(&expenses)

	return c.JSON(fiber.Map{
		"income":   income,
		"expenses": expenses,
		"balance":  income - expenses,
		"period":   period,
	})
}

func (h *FinanceHandler) Categories(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var results []struct {
		Category string  `json:"category"`
		Total    float64 `json:"total"`
		Count    int     `json:"count"`
	}
	h.db.Model(&models.Transaction{}).
		Where("user_id = ? AND type = 'expense'", userID).
		Select("category, SUM(amount) as total, COUNT(*) as count").
		Group("category").
		Order("total desc").
		Scan(&results)
	return c.JSON(results)
}
