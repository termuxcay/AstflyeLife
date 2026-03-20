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
	memberSince string

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
	runtime.WindowMaximise(ctx)
	if err := a.startOAuthServer(); err != nil {
		fmt.Printf("failed to start OAuth server: %v\n", err)
	}
	go a.startNotificationLoop()
}

func (a *App) startNotificationLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if a.currentDiscordID() == "" {
				continue
			}
			tasks, _ := a.GetTasksDue(5)
			for _, t := range tasks {
				runtime.EventsEmit(a.ctx, "task:due-soon", t)
			}
		case <-a.ctx.Done():
			return
		}
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
		a.memberSince = r.URL.Query().Get("joined_at")
		a.mu.Unlock()

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(successPage()))
		runtime.EventsEmit(a.ctx, "auth:success")
	})

	srv.Serve(ln)
}

func successPage() string {
	return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Astflye — Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08050f;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;position:relative}
.orb{position:fixed;border-radius:50%;filter:blur(90px);pointer-events:none}
.o1{width:360px;height:360px;background:rgba(180,85,255,0.13);top:-100px;left:-80px;animation:p1 6s ease-in-out infinite}
.o2{width:280px;height:280px;background:rgba(255,85,170,0.09);bottom:-60px;right:-60px;animation:p1 8s ease-in-out infinite reverse}
@keyframes p1{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.12);opacity:1}}
.card{position:relative;background:rgba(14,8,24,0.92);border:1px solid rgba(180,85,255,0.22);border-radius:28px;padding:52px 60px;text-align:center;backdrop-filter:blur(20px);box-shadow:0 0 80px rgba(180,85,255,0.08),0 24px 80px rgba(0,0,0,0.55);animation:su .45s cubic-bezier(.16,1,.3,1) both;max-width:400px;width:90vw}
@keyframes su{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.card::before{content:'';position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,rgba(180,85,255,0.7),rgba(255,85,170,0.5),transparent);border-radius:99px}
.icon{width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,rgba(180,85,255,0.18),rgba(255,85,170,0.1));border:1.5px solid rgba(180,85,255,0.45);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;box-shadow:0 0 32px rgba(180,85,255,0.22),inset 0 0 16px rgba(180,85,255,0.06);animation:pop .5s cubic-bezier(.175,.885,.32,1.275) .25s both}
@keyframes pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.brand{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(180,85,255,0.55);margin-bottom:14px;font-weight:500}
h1{font-size:24px;font-weight:700;background:linear-gradient(135deg,#e8dcfc 0%,#b455ff 60%,#ff55aa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:10px;letter-spacing:-.02em}
p{font-size:13px;color:rgba(255,255,255,0.38);line-height:1.65}
.dots{display:flex;gap:7px;justify-content:center;margin-top:28px}
.dot{width:7px;height:7px;border-radius:50%;background:rgba(180,85,255,0.28);animation:bl 1.5s ease-in-out infinite}
.dot:nth-child(2){animation-delay:.25s}.dot:nth-child(3){animation-delay:.5s}
@keyframes bl{0%,80%,100%{transform:scale(1);opacity:.3}40%{transform:scale(1.3);opacity:1;background:#b455ff;box-shadow:0 0 10px rgba(180,85,255,.9)}}
</style></head><body>
<div class="orb o1"></div><div class="orb o2"></div>
<div class="card">
  <div class="icon">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#b455ff"/><stop offset="100%" stop-color="#ff55aa"/></linearGradient></defs>
      <polyline points="20 6 9 17 4 12" stroke="url(#g)" stroke-width="2.5"/>
    </svg>
  </div>
  <p class="brand">astflye</p>
  <h1>Login realizado!</h1>
  <p>Autenticação concluída com sucesso.<br>Pode fechar esta aba.</p>
  <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
</div>
</body></html>`
}

func errorPage(errCode string) string {
	msg := "Erro ao fazer login."
	if errCode == "not_member" {
		msg = "Você precisa entrar no servidor Discord primeiro."
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Astflye — Erro</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08050f;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;position:relative}
.orb{position:fixed;border-radius:50%%;filter:blur(90px);pointer-events:none}
.o1{width:340px;height:340px;background:rgba(255,51,102,0.1);top:-80px;left:-80px;animation:p1 6s ease-in-out infinite}
.o2{width:260px;height:260px;background:rgba(255,100,80,0.07);bottom:-60px;right:-60px;animation:p1 8s ease-in-out infinite reverse}
@keyframes p1{0%%,100%%{transform:scale(1);opacity:.7}50%%{transform:scale(1.1);opacity:1}}
.card{position:relative;background:rgba(14,8,24,0.92);border:1px solid rgba(255,51,102,0.2);border-radius:28px;padding:52px 60px;text-align:center;backdrop-filter:blur(20px);box-shadow:0 0 60px rgba(255,51,102,0.07),0 24px 80px rgba(0,0,0,0.55);animation:su .45s cubic-bezier(.16,1,.3,1) both;max-width:400px;width:90vw}
@keyframes su{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.card::before{content:'';position:absolute;top:0;left:15%%;right:15%%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,51,102,0.6),rgba(255,100,80,0.4),transparent)}
.icon{width:76px;height:76px;border-radius:50%%;background:rgba(255,51,102,0.1);border:1.5px solid rgba(255,51,102,0.35);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;box-shadow:0 0 28px rgba(255,51,102,0.15);animation:pop .5s cubic-bezier(.175,.885,.32,1.275) .25s both}
@keyframes pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.brand{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,51,102,0.5);margin-bottom:14px;font-weight:500}
h1{font-size:22px;font-weight:700;color:#ff6688;margin-bottom:10px;letter-spacing:-.01em}
p{font-size:13px;color:rgba(255,255,255,0.38);line-height:1.65}
</style></head><body>
<div class="orb o1"></div><div class="orb o2"></div>
<div class="card">
  <div class="icon">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff3366" stroke-width="2.5" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </div>
  <p class="brand">astflye</p>
  <h1>%s</h1>
  <p>Pode fechar esta aba e tentar novamente.</p>
</div>
</body></html>`, msg)
}

// ─── User info getters (Wails bridge) ─────────────────────────────────────────

func (a *App) GetAccessToken() string { a.mu.Lock(); defer a.mu.Unlock(); return a.accessToken }
func (a *App) GetDiscordID() string   { a.mu.Lock(); defer a.mu.Unlock(); return a.discordID }
func (a *App) GetUsername() string    { a.mu.Lock(); defer a.mu.Unlock(); return a.username }
func (a *App) GetGlobalName() string  { a.mu.Lock(); defer a.mu.Unlock(); return a.globalName }
func (a *App) GetAvatar() string      { a.mu.Lock(); defer a.mu.Unlock(); return a.avatar }
func (a *App) GetMemberSince() string { a.mu.Lock(); defer a.mu.Unlock(); return a.memberSince }
func (a *App) IsAuthenticated() bool  { a.mu.Lock(); defer a.mu.Unlock(); return a.accessToken != "" }

func (a *App) Logout() {
	a.mu.Lock()
	a.accessToken, a.discordID, a.username, a.globalName, a.avatar, a.memberSince = "", "", "", "", "", ""
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

func (a *App) GetTasksDue(minutes int) ([]Task, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return nil, err
	}
	tasks, err := getTasks(dir, a.currentDiscordID())
	if err != nil {
		return nil, err
	}
	now := time.Now()
	threshold := now.Add(time.Duration(minutes) * time.Minute)
	due := []Task{}
	for _, t := range tasks {
		if t.Status == "completed" || t.Status == "skipped" || t.DueDate == "" {
			continue
		}
		dueDateStr := t.DueDate
		if t.DueTime != "" {
			dueDateStr += "T" + t.DueTime + ":00"
		} else {
			dueDateStr += "T23:59:00"
		}
		dueTime, err := time.ParseInLocation("2006-01-02T15:04:05", dueDateStr, now.Location())
		if err != nil {
			continue
		}
		if dueTime.After(now) && dueTime.Before(threshold) {
			due = append(due, t)
		}
	}
	return due, nil
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
	return getFinanceSummary(dir, a.currentDiscordID(), period)
}

func (a *App) GetCategories() ([]string, error) {
	dir, err := a.appDataDir()
	if err != nil {
		return nil, err
	}
	return getCategories(dir, a.currentDiscordID())
}
