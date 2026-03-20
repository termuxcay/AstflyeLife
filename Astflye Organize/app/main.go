package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config error: %v\n\nCrie o arquivo %%AppData%%\\Astflye\\.env com:\n  DISCORD_CLIENT_ID=...\n  DISCORD_CLIENT_SECRET=...\n  DISCORD_GUILD_ID=...\n  DISCORD_REDIRECT_URI=http://localhost:3005/auth/callback\n", err)
	}

	app := NewApp(cfg)

	err = wails.Run(&options.App{
		Title:     "Astflye Life",
		Width:     1440,
		Height:    900,
		MinWidth:  1024,
		MinHeight: 700,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 8, G: 5, B: 15, A: 255},
		OnStartup:        app.startup,
		Bind:             []interface{}{app},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
