package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DiscordClientID     string
	DiscordClientSecret string
	DiscordRedirectURI  string
	DiscordGuildID      string
	DiscordBotToken     string
	DiscordAdminRole    string
	Port                string
	JWTSecret           string
	JWTRefreshSecret    string
	DBPath              string
	AllowedOrigin       string
	ClaudeAPIKey        string
	ClaudeModel         string
}

func Load() (*Config, error) {
	_ = godotenv.Load() // ignore error — env may already be set

	required := []string{
		"DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET",
		"DISCORD_REDIRECT_URI", "DISCORD_GUILD_ID",
		"DISCORD_BOT_TOKEN", "DISCORD_ADMIN_ROLE",
		"JWT_SECRET", "JWT_REFRESH_SECRET",
	}
	for _, key := range required {
		if os.Getenv(key) == "" {
			return nil, fmt.Errorf("missing required env var: %s", key)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3005"
	}
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/astflye.db"
	}
	model := os.Getenv("CLAUDE_MODEL")
	if model == "" {
		model = "claude-sonnet-4-6"
	}

	return &Config{
		DiscordClientID:     os.Getenv("DISCORD_CLIENT_ID"),
		DiscordClientSecret: os.Getenv("DISCORD_CLIENT_SECRET"),
		DiscordRedirectURI:  os.Getenv("DISCORD_REDIRECT_URI"),
		DiscordGuildID:      os.Getenv("DISCORD_GUILD_ID"),
		DiscordBotToken:     os.Getenv("DISCORD_BOT_TOKEN"),
		DiscordAdminRole:    os.Getenv("DISCORD_ADMIN_ROLE"),
		Port:                port,
		JWTSecret:           os.Getenv("JWT_SECRET"),
		JWTRefreshSecret:    os.Getenv("JWT_REFRESH_SECRET"),
		DBPath:              dbPath,
		AllowedOrigin:       os.Getenv("ALLOWED_ORIGIN"),
		ClaudeAPIKey:        os.Getenv("CLAUDE_API_KEY"),
		ClaudeModel:         model,
	}, nil
}
