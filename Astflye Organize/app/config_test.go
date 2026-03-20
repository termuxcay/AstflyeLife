package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig_MissingRequired(t *testing.T) {
	for _, k := range []string{"DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID", "DISCORD_REDIRECT_URI"} {
		os.Unsetenv(k)
	}
	_, err := loadConfig()
	if err == nil {
		t.Fatal("expected error for missing required vars, got nil")
	}
}

func TestLoadConfig_Valid(t *testing.T) {
	t.Setenv("DISCORD_CLIENT_ID", "test_id")
	t.Setenv("DISCORD_CLIENT_SECRET", "test_secret")
	t.Setenv("DISCORD_GUILD_ID", "test_guild")
	t.Setenv("DISCORD_REDIRECT_URI", "http://localhost:3005/auth/callback")
	t.Setenv("JWT_SECRET", "my_secret")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.DiscordClientID != "test_id" {
		t.Errorf("ClientID = %q, want %q", cfg.DiscordClientID, "test_id")
	}
	if cfg.JWTSecret == "" {
		t.Error("JWTSecret should not be empty")
	}
}

func TestDataDir(t *testing.T) {
	dir, err := dataDir()
	if err != nil {
		t.Fatalf("dataDir() error: %v", err)
	}
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Errorf("dataDir() returned non-existent path: %s", dir)
	}
	_ = filepath.Join(dir)
}
