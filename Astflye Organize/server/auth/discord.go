package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"golang.org/x/oauth2"
)

// StateStore provides CSRF protection for OAuth2 flow.
type StateStore struct {
	mu     sync.Mutex
	states map[string]time.Time
}

func NewStateStore() *StateStore {
	s := &StateStore{states: make(map[string]time.Time)}
	go s.cleanup()
	return s
}

func (s *StateStore) Generate() string {
	b := make([]byte, 16)
	rand.Read(b)
	state := hex.EncodeToString(b)
	s.mu.Lock()
	s.states[state] = time.Now().Add(5 * time.Minute)
	s.mu.Unlock()
	return state
}

func (s *StateStore) Validate(state string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	exp, ok := s.states[state]
	if !ok || time.Now().After(exp) {
		delete(s.states, state)
		return false
	}
	delete(s.states, state) // consume
	return true
}

func (s *StateStore) cleanup() {
	for range time.Tick(10 * time.Minute) {
		s.mu.Lock()
		for k, v := range s.states {
			if time.Now().After(v) {
				delete(s.states, k)
			}
		}
		s.mu.Unlock()
	}
}

// DiscordUser is the response from Discord's /users/@me endpoint.
type DiscordUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
}

func NewOAuth2Config(clientID, clientSecret, redirectURI string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURI,
		Scopes:       []string{"identify", "guilds"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://discord.com/api/oauth2/authorize",
			TokenURL: "https://discord.com/api/oauth2/token",
		},
	}
}

func FetchDiscordUser(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config) (*DiscordUser, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://discord.com/api/users/@me")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var user DiscordUser
	return &user, json.Unmarshal(body, &user)
}

type DiscordGuild struct {
	ID string `json:"id"`
}

func IsGuildMember(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config, guildID string) (bool, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://discord.com/api/users/@me/guilds")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var guilds []DiscordGuild
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

func AvatarURL(userID, avatarHash string) string {
	if avatarHash == "" {
		return ""
	}
	return fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", userID, avatarHash)
}

func DiscordAvatarURL(u *DiscordUser) string {
	return AvatarURL(u.ID, u.Avatar)
}

// BotCheckAdminRole checks if a user has the admin role using the bot token.
func BotCheckAdminRole(ctx context.Context, botToken, guildID, userID, adminRoleID string) (bool, error) {
	url := fmt.Sprintf("https://discord.com/api/guilds/%s/members/%s", guildID, userID)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bot "+botToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return false, nil
	}
	var member struct {
		Roles []string `json:"roles"`
	}
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &member)
	for _, r := range member.Roles {
		if r == adminRoleID {
			return true, nil
		}
	}
	return false, nil
}
