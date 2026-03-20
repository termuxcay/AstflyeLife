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
