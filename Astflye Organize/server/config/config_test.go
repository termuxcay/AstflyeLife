package config_test

import (
	"os"
	"testing"
	"github.com/astflye/life/server/config"
)

func TestLoadConfig_MissingRequired(t *testing.T) {
	os.Clearenv()
	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error for missing required env vars, got nil")
	}
}

func TestLoadConfig_Valid(t *testing.T) {
	os.Setenv("DISCORD_CLIENT_ID", "test-id")
	os.Setenv("DISCORD_CLIENT_SECRET", "test-secret")
	os.Setenv("DISCORD_REDIRECT_URI", "http://localhost:3005/auth/callback")
	os.Setenv("DISCORD_GUILD_ID", "123456789")
	os.Setenv("DISCORD_BOT_TOKEN", "bot-token")
	os.Setenv("DISCORD_ADMIN_ROLE", "987654321")
	os.Setenv("JWT_SECRET", "super-secret-jwt-key-32-bytes!!")
	os.Setenv("JWT_REFRESH_SECRET", "super-secret-refresh-32-bytes!!")
	os.Setenv("PORT", "3005")
	os.Setenv("DB_PATH", "./test.db")
	os.Setenv("ALLOWED_ORIGIN", "http://localhost:34115")
	defer os.Clearenv()

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "3005" {
		t.Errorf("expected port 3005, got %s", cfg.Port)
	}
}
