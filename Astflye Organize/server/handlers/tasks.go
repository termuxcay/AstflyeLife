package handlers

import (
	"time"

	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaskHandler struct{ db *gorm.DB }

func NewTaskHandler(db *gorm.DB) *TaskHandler { return &TaskHandler{db: db} }

func (h *TaskHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	query := h.db.Where("user_id = ?", userID)
	if s := c.Query("status"); s != "" {
		query = query.Where("status = ?", s)
	}
	if r := c.Query("recurrence"); r != "" {
		query = query.Where("recurrence = ?", r)
	}
	if cat := c.Query("category"); cat != "" {
		query = query.Where("category = ?", cat)
	}
	var tasks []models.Task
	query.Order("created_at desc").Find(&tasks)
	return c.JSON(tasks)
}

func (h *TaskHandler) Create(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body models.Task
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "title is required"})
	}
	body.ID = uuid.New().String()
	body.UserID = userID
	if body.Status == "" {
		body.Status = "pending"
	}
	if body.Priority == "" {
		body.Priority = "medium"
	}
	if body.Recurrence == "" {
		body.Recurrence = "none"
	}
	body.CreatedAt = time.Now()
	h.db.Create(&body)
	return c.Status(201).JSON(body)
}

func (h *TaskHandler) Update(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var task models.Task
	if err := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).First(&task).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "task not found"})
	}
	var updates models.Task
	c.BodyParser(&updates)
	h.db.Model(&task).Updates(updates)
	return c.JSON(task)
}

func (h *TaskHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	result := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).Delete(&models.Task{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "task not found"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *TaskHandler) UpdateStatus(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var task models.Task
	if err := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).First(&task).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "task not found"})
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil || body.Status == "" {
		return c.Status(400).JSON(fiber.Map{"error": "status required"})
	}
	updates := map[string]interface{}{"status": body.Status}
	if body.Status == "completed" {
		now := time.Now()
		updates["completed_at"] = now
		go UpdateStreak(h.db, userID)
	}
	h.db.Model(&task).Updates(updates)
	h.db.First(&task, "id = ?", task.ID)
	return c.JSON(task)
}
