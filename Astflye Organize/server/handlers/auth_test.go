package handlers_test

import (
	"net/http/httptest"
	"testing"

	"github.com/astflye/life/server/db"
	"github.com/astflye/life/server/handlers"
	"github.com/gofiber/fiber/v2"
)

func setupTestApp(t *testing.T) (*fiber.App, func()) {
	t.Helper()
	database, err := db.Init(":memory:")
	if err != nil {
		t.Fatalf("db init: %v", err)
	}
	app := fiber.New()
	h := handlers.NewAuthHandler(database, handlers.AuthHandlerConfig{
		JWTSecret:        "test-jwt-secret-that-is-32bytes!",
		JWTRefreshSecret: "test-refresh-secret-32bytes!!!!!",
		DiscordGuildID:   "test-guild",
	})
	app.Get("/auth/callback", h.Callback)
	app.Post("/auth/refresh", h.Refresh)
	app.Post("/auth/logout", h.Logout)
	return app, func() {}
}

func TestAuthCallback_MissingCode(t *testing.T) {
	app, cleanup := setupTestApp(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/auth/callback?state=test", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 400 {
		t.Errorf("expected 400 for missing code, got %d", resp.StatusCode)
	}
}

func TestAuthRefresh_MissingToken(t *testing.T) {
	app, cleanup := setupTestApp(t)
	defer cleanup()

	req := httptest.NewRequest("POST", "/auth/refresh", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 400 {
		t.Errorf("expected 400 for missing refresh token, got %d", resp.StatusCode)
	}
}
