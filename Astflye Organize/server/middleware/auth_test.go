package middleware_test

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/astflye/life/server/auth"
	"github.com/astflye/life/server/middleware"
	"github.com/gofiber/fiber/v2"
)

const secret = "test-jwt-secret-that-is-32bytes!"

func TestAuthMiddleware_MissingToken(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.RequireAuth(secret))
	app.Get("/test", func(c *fiber.Ctx) error { return c.SendString("ok") })

	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 401 {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.RequireAuth(secret))
	app.Get("/test", func(c *fiber.Ctx) error {
		userID := c.Locals("userID").(string)
		return c.SendString(userID)
	})

	token, _ := auth.IssueAccessToken("user-abc", secret)
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "user-abc" {
		t.Errorf("expected user-abc in body, got %s", body)
	}
}
