package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/oauth2"
)

type App struct {
	ctx      context.Context
	cfg      *Config
	oauthCfg *oauth2.Config
	oauthSrv *http.Server
	ss       *stateStore

	mu          sync.Mutex
	accessToken string
	discordID   string
	username    string
	globalName  string
	avatar      string

	loopMu      sync.Mutex
	loopRunning bool
}

func NewApp(cfg *Config) *App {
	return &App{
		cfg:      cfg,
		oauthCfg: newOAuth2Config(cfg),
		ss:       newStateStore(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if err := a.startOAuthServer(); err != nil {
		fmt.Printf("failed to start OAuth server: %v\n", err)
	}
}

// ─── Login flow ───────────────────────────────────────────────────────────────

// StartLogin starts the loopback receiver, builds the Discord OAuth URL, opens browser.
func (a *App) StartLogin() error {
	a.loopMu.Lock()
	running := a.loopRunning
	a.loopMu.Unlock()
	if running {
		return errors.New("login already in progress")
	}

	// Bind loopback listener first to reserve the port before opening browser
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("no free port: %w", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	doneURL := fmt.Sprintf("http://127.0.0.1:%d/auth/done", port)

	a.loopMu.Lock()
	a.loopRunning = true
	a.loopMu.Unlock()

	go a.listenForTokens(ln, port)

	// Generate CSRF state encoding the doneURL
	state := a.ss.Generate(doneURL)
	authURL := a.oauthCfg.AuthCodeURL(state, oauth2.AccessTypeOnline)
	runtime.BrowserOpenURL(a.ctx, authURL)
	return nil
}

func (a *App) listenForTokens(ln net.Listener, port int) {
	defer func() {
		a.loopMu.Lock()
		a.loopRunning = false
		a.loopMu.Unlock()
	}()

	mux := http.NewServeMux()
	srv := &http.Server{Handler: mux}

	// Timeout: shut down after 5 minutes if user never completes auth
	timer := time.AfterFunc(5*time.Minute, func() {
		srv.Shutdown(context.Background())
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "auth:timeout")
		}
	})

	mux.HandleFunc("/auth/done", func(w http.ResponseWriter, r *http.Request) {
		timer.Stop()
		defer func() {
			go func() {
				time.Sleep(500 * time.Millisecond)
				srv.Shutdown(context.Background())
			}()
		}()

		errParam := r.URL.Query().Get("error")
		if errParam != "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(errorPage(errParam)))
			runtime.EventsEmit(a.ctx, "auth:error", errParam)
			return
		}

		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "missing token", 400)
			return
		}

		a.mu.Lock()
		a.accessToken = token
		a.discordID = r.URL.Query().Get("discord_id")
		a.username = r.URL.Query().Get("username")
		a.globalName = r.URL.Query().Get("global_name")
		a.avatar = r.URL.Query().Get("avatar")
		a.mu.Unlock()

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(successPage()))
		runtime.EventsEmit(a.ctx, "auth:success")
	})

	srv.Serve(ln)
}

func successPage() string {
	return `<!DOCTYPE html><html><body style="background:#08050f;color:#b455ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><h2 style="font-size:1.3rem;margin:0">&#10003; Login realizado!</h2><p style="margin:0;font-size:.9rem;opacity:.6">Pode fechar esta aba.</p></body></html>`
}

func errorPage(errCode string) string {
	msg := "Erro ao fazer login."
	if errCode == "not_member" {
		msg = "Você precisa entrar no servidor Discord primeiro."
	}
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="background:#08050f;color:#ff5555;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><h2 style="font-size:1.3rem;margin:0">&#10007; %s</h2><p style="margin:0;font-size:.9rem;opacity:.6">Pode fechar esta aba e tentar novamente.</p></body></html>`, msg)
}

// ─── User info getters (Wails bridge) ─────────────────────────────────────────

func (a *App) GetAccessToken() string { a.mu.Lock(); defer a.mu.Unlock(); return a.accessToken }
func (a *App) GetDiscordID() string   { a.mu.Lock(); defer a.mu.Unlock(); return a.discordID }
func (a *App) GetUsername() string    { a.mu.Lock(); defer a.mu.Unlock(); return a.username }
func (a *App) GetGlobalName() string  { a.mu.Lock(); defer a.mu.Unlock(); return a.globalName }
func (a *App) GetAvatar() string      { a.mu.Lock(); defer a.mu.Unlock(); return a.avatar }
func (a *App) IsAuthenticated() bool  { a.mu.Lock(); defer a.mu.Unlock(); return a.accessToken != "" }

func (a *App) Logout() {
	a.mu.Lock()
	a.accessToken, a.discordID, a.username, a.globalName, a.avatar = "", "", "", "", ""
	a.mu.Unlock()
}

// ─── Data bridge helpers ──────────────────────────────────────────────────────

func (a *App) currentDiscordID() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.discordID
}

func (a *App) appDataDir() (string, error) {
	return dataDir()
}

// ─── Task bridge methods ──────────────────────────────────────────────────────

func (a *App) GetTasks() ([]Task, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return nil, err
	}
	return getTasks(dir, a.currentDiscordID())
}

func (a *App) CreateTask(input TaskInput) (Task, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return Task{}, err
	}
	return createTask(dir, a.currentDiscordID(), input)
}

func (a *App) UpdateTask(id string, input TaskInput) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return updateTask(dir, a.currentDiscordID(), id, input)
}

func (a *App) UpdateTaskStatus(id, status string) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return updateTaskStatus(dir, a.currentDiscordID(), id, status)
}

func (a *App) DeleteTask(id string) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return deleteTask(dir, a.currentDiscordID(), id)
}

// ─── Finance bridge methods ───────────────────────────────────────────────────

func (a *App) GetTransactions() ([]Transaction, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return nil, err
	}
	return getTransactions(dir, a.currentDiscordID())
}

func (a *App) CreateTransaction(input TransactionInput) (Transaction, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return Transaction{}, err
	}
	return createTransaction(dir, a.currentDiscordID(), input)
}

func (a *App) UpdateTransaction(id string, input TransactionInput) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return updateTransaction(dir, a.currentDiscordID(), id, input)
}

func (a *App) DeleteTransaction(id string) error {
	dir, err := a.appDataDir()
	if err != nil {
		return err
	}
	return deleteTransaction(dir, a.currentDiscordID(), id)
}

func (a *App) GetFinanceSummary(period string) (FinanceSummary, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return FinanceSummary{}, err
	}
	return getFinanceSummary(dir, a.currentDiscordID())
}

func (a *App) GetCategories() ([]string, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return nil, err
	}
	return getCategories(dir, a.currentDiscordID())
}
