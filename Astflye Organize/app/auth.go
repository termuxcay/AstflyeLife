package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

// ─── StateStore ────────────────────────────────────────────────────────────────

type stateEntry struct {
	expiry  time.Time
	doneURL string
}

type stateStore struct {
	mu     sync.Mutex
	states map[string]stateEntry
}

func newStateStore() *stateStore {
	s := &stateStore{states: make(map[string]stateEntry)}
	go s.cleanup()
	return s
}

// Generate creates a CSRF state token that encodes doneURL inside it.
func (s *stateStore) Generate(doneURL string) string {
	b := make([]byte, 16)
	rand.Read(b)
	state := hex.EncodeToString(b)
	s.mu.Lock()
	s.states[state] = stateEntry{expiry: time.Now().Add(10 * time.Minute), doneURL: doneURL}
	s.mu.Unlock()
	return state
}

// Consume validates and removes the state, returning the stored doneURL.
func (s *stateStore) Consume(state string) (doneURL string, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, exists := s.states[state]
	if !exists || time.Now().After(entry.expiry) {
		delete(s.states, state)
		return "", false
	}
	delete(s.states, state)
	return entry.doneURL, true
}

func (s *stateStore) cleanup() {
	for range time.Tick(5 * time.Minute) {
		s.mu.Lock()
		for k, v := range s.states {
			if time.Now().After(v.expiry) {
				delete(s.states, k)
			}
		}
		s.mu.Unlock()
	}
}

// ─── Discord API ───────────────────────────────────────────────────────────────

type discordUser struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"`
	Avatar        string `json:"avatar"`
	Discriminator string `json:"discriminator"`
}

func fetchDiscordUser(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config) (*discordUser, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://discord.com/api/users/@me")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("discord /users/@me returned %d: %s", resp.StatusCode, body)
	}
	var u discordUser
	if err := json.Unmarshal(body, &u); err != nil {
		return nil, err
	}
	if u.ID == "" || u.Username == "" {
		return nil, errors.New("discord returned incomplete user payload")
	}
	if u.GlobalName == "" {
		u.GlobalName = u.Username
	}
	return &u, nil
}

type discordGuild struct {
	ID string `json:"id"`
}

func isGuildMember(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config, guildID string) (bool, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://discord.com/api/users/@me/guilds")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var guilds []discordGuild
	if err := json.Unmarshal(body, &guilds); err != nil {
		return false, fmt.Errorf("parse guilds: %w", err)
	}
	for _, g := range guilds {
		if g.ID == guildID {
			return true, nil
		}
	}
	return false, nil
}

func discordAvatarURL(userID, avatarHash, discriminator string) string {
	if avatarHash != "" {
		return fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", userID, avatarHash)
	}
	var index int64
	if discriminator == "0" || discriminator == "" {
		var snowflake int64
		fmt.Sscanf(userID, "%d", &snowflake)
		index = (snowflake >> 22) % 6
	} else {
		var d int64
		fmt.Sscanf(discriminator, "%d", &d)
		index = d % 5
	}
	return fmt.Sprintf("https://cdn.discordapp.com/embed/avatars/%d.png", index)
}

// ─── JWT ───────────────────────────────────────────────────────────────────────

type jwtClaims struct {
	DiscordID string `json:"discord_id"`
	jwt.RegisteredClaims
}

func issueJWT(discordID, secret string, expiry time.Duration) (string, error) {
	claims := jwtClaims{
		DiscordID: discordID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func validateJWT(tokenStr, secret string) (discordID string, err error) {
	token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := token.Claims.(*jwtClaims)
	if !ok || !token.Valid {
		return "", errors.New("invalid token")
	}
	return claims.DiscordID, nil
}

// ─── OAuth2 Config ─────────────────────────────────────────────────────────────

func newOAuth2Config(cfg *Config) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     cfg.DiscordClientID,
		ClientSecret: cfg.DiscordClientSecret,
		RedirectURL:  cfg.DiscordRedirectURI,
		Scopes:       []string{"identify", "guilds"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://discord.com/api/oauth2/authorize",
			TokenURL: "https://discord.com/api/oauth2/token",
		},
	}
}

// ─── Embedded OAuth HTTP server (port 3005) ────────────────────────────────────

func (a *App) startOAuthServer() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/auth/callback", a.handleOAuthCallback)
	srv := &http.Server{Addr: ":3005", Handler: mux}
	a.oauthSrv = srv
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("OAuth server error: %v\n", err)
		}
	}()
	return nil
}

func (a *App) handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		http.Error(w, "missing code or state", 400)
		return
	}

	doneURL, ok := a.ss.Consume(state)
	if !ok {
		http.Error(w, "invalid or expired state", 400)
		return
	}

	token, err := a.oauthCfg.Exchange(r.Context(), code)
	if err != nil {
		http.Redirect(w, r, doneURL+"?error=exchange_failed", http.StatusFound)
		return
	}

	user, err := fetchDiscordUser(r.Context(), token, a.oauthCfg)
	if err != nil {
		http.Redirect(w, r, doneURL+"?error=discord_error", http.StatusFound)
		return
	}

	member, err := isGuildMember(r.Context(), token, a.oauthCfg, a.cfg.DiscordGuildID)
	if err != nil || !member {
		http.Redirect(w, r, doneURL+"?error=not_member", http.StatusFound)
		return
	}

	jwtToken, err := issueJWT(user.ID, a.cfg.JWTSecret, 8*time.Hour)
	if err != nil {
		http.Redirect(w, r, doneURL+"?error=jwt_failed", http.StatusFound)
		return
	}

	avatarURL := discordAvatarURL(user.ID, user.Avatar, user.Discriminator)

	q := url.Values{
		"token":       {jwtToken},
		"username":    {user.Username},
		"global_name": {user.GlobalName},
		"avatar":      {avatarURL},
		"discord_id":  {user.ID},
	}
	http.Redirect(w, r, doneURL+"?"+q.Encode(), http.StatusFound)
}
