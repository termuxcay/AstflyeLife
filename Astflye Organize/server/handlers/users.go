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
	return c.JSON(fiber.Map{
		"id":       user.ID,
		"username": user.Username,
		"avatar":   user.Avatar,
	})
}
