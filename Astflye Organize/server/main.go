package main

import (
	"log"

	"github.com/astflye/life/server/auth"
	"github.com/astflye/life/server/config"
	"github.com/astflye/life/server/db"
	"github.com/astflye/life/server/handlers"
	"github.com/astflye/life/server/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	database, err := db.Init(cfg.DBPath)
	if err != nil {
		log.Fatalf("db error: %v", err)
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigin,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Authorization",
		AllowCredentials: true,
	}))

	oauth2Cfg := auth.NewOAuth2Config(cfg.DiscordClientID, cfg.DiscordClientSecret, cfg.DiscordRedirectURI)
	stateStore := auth.NewStateStore()

	authHandler := handlers.NewAuthHandler(database, handlers.AuthHandlerConfig{
		JWTSecret:        cfg.JWTSecret,
		JWTRefreshSecret: cfg.JWTRefreshSecret,
		DiscordGuildID:   cfg.DiscordGuildID,
		OAuth2Config:     oauth2Cfg,
		StateStore:       stateStore,
	})
	userHandler := handlers.NewUserHandler(database)

	// Auth routes (rate-limited)
	authGroup := app.Group("/auth", middleware.AuthRateLimit())
	authGroup.Get("/login-url", authHandler.GetLoginURL)
	authGroup.Get("/callback", authHandler.Callback)
	authGroup.Post("/refresh", authHandler.Refresh)
	authGroup.Post("/logout", authHandler.Logout)

	// Protected routes
	api := app.Group("/", middleware.RequireAuth(cfg.JWTSecret))
	api.Get("/users/me", userHandler.Me)
	api.Get("/users/:id", userHandler.GetByID)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	log.Printf("Astflye server starting on :%s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
