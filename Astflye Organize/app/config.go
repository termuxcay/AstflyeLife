package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

type Config struct {
	DiscordClientID     string
	DiscordClientSecret string
	DiscordGuildID      string
	DiscordRedirectURI  string
	JWTSecret           string
}

// loadConfig loads config from %AppData%/Astflye/.env and environment variables.
// Environment variables take precedence over the .env file.
func loadConfig() (*Config, error) {
	if dir, err := os.UserConfigDir(); err == nil {
		_ = godotenv.Load(filepath.Join(dir, "Astflye", ".env"))
	}
	_ = godotenv.Load()

	required := []string{
		"DISCORD_CLIENT_ID",
		"DISCORD_CLIENT_SECRET",
		"DISCORD_GUILD_ID",
		"DISCORD_REDIRECT_URI",
	}
	for _, k := range required {
		if os.Getenv(k) == "" {
			return nil, fmt.Errorf("missing required env var: %s", k)
		}
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		b := make([]byte, 32)
		rand.Read(b)
		secret = hex.EncodeToString(b)
	}

	return &Config{
		DiscordClientID:     os.Getenv("DISCORD_CLIENT_ID"),
		DiscordClientSecret: os.Getenv("DISCORD_CLIENT_SECRET"),
		DiscordGuildID:      os.Getenv("DISCORD_GUILD_ID"),
		DiscordRedirectURI:  os.Getenv("DISCORD_REDIRECT_URI"),
		JWTSecret:           secret,
	}, nil
}

// dataDir returns (and creates if needed) the app's data directory.
func dataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("userConfigDir: %w", err)
	}
	dir := filepath.Join(base, "Astflye")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("mkdirAll %s: %w", dir, err)
	}
	return dir, nil
}
