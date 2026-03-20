package middleware

import (
	"strings"

	"github.com/astflye/life/server/auth"
	"github.com/gofiber/fiber/v2"
)

// ExtractUserID validates the Bearer token from the Authorization header
// and returns the userID. Used for WebSocket upgrade checks.
func ExtractUserID(c *fiber.Ctx, jwtSecret string) (string, error) {
	header := c.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		// also check query param for WS clients that can't set headers
		token := c.Query("token")
		if token == "" {
			return "", fiber.ErrUnauthorized
		}
		return auth.ValidateAccessToken(token, jwtSecret)
	}
	return auth.ValidateAccessToken(strings.TrimPrefix(header, "Bearer "), jwtSecret)
}

func RequireAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			return c.Status(401).JSON(fiber.Map{"error": "missing or invalid authorization header"})
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		userID, err := auth.ValidateAccessToken(tokenStr, jwtSecret)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid or expired token"})
		}
		c.Locals("userID", userID)
		return c.Next()
	}
}
