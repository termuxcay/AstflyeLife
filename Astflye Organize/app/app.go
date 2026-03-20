package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx          context.Context
	accessToken  string
	refreshToken string
	mu           sync.Mutex
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// StartLogin opens the browser to the Discord OAuth URL and starts
// the loopback listener on :34115 to receive tokens.
func (a *App) StartLogin(serverURL string) error {
	resp, err := http.Get(serverURL + "/auth/login-url")
	if err != nil {
		return fmt.Errorf("cannot reach server: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		URL string `json:"url"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	runtime.BrowserOpenURL(a.ctx, result.URL)
	go a.listenForTokens()
	return nil
}

func (a *App) listenForTokens() {
	mux := http.NewServeMux()
	srv := &http.Server{Addr: ":34115", Handler: mux}

	mux.HandleFunc("/auth/done", func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		refresh := r.URL.Query().Get("refresh")
		if token == "" {
			http.Error(w, "missing token", 400)
			return
		}
		a.mu.Lock()
		a.accessToken = token
		a.refreshToken = refresh
		a.mu.Unlock()

		runtime.EventsEmit(a.ctx, "auth:success")
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte("<html><body style='background:#08050f;color:#b455ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh'><h2>Login successful! You can close this tab.</h2></body></html>"))
		go func() {
			time.Sleep(500 * time.Millisecond)
			srv.Shutdown(context.Background())
		}()
	})

	srv.ListenAndServe()
}

// GetAccessToken exposes the token to the frontend JS.
func (a *App) GetAccessToken() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.accessToken
}

// IsAuthenticated returns whether the user has a token.
func (a *App) IsAuthenticated() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.accessToken != ""
}

// Logout clears tokens.
func (a *App) Logout() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.accessToken = ""
	a.refreshToken = ""
}
