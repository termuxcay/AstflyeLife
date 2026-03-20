package main

import (
	"testing"
	"time"
)

// --- JWT tests ---

func TestIssueAndValidateJWT(t *testing.T) {
	secret := "test_secret_32_chars_long_enough!"
	discordID := "123456789012345678"

	token, err := issueJWT(discordID, secret, 1*time.Hour)
	if err != nil {
		t.Fatalf("issueJWT error: %v", err)
	}
	if token == "" {
		t.Fatal("token is empty")
	}

	got, err := validateJWT(token, secret)
	if err != nil {
		t.Fatalf("validateJWT error: %v", err)
	}
	if got != discordID {
		t.Errorf("discordID = %q, want %q", got, discordID)
	}
}

func TestValidateJWT_Expired(t *testing.T) {
	secret := "test_secret_32_chars_long_enough!"
	token, _ := issueJWT("123", secret, -1*time.Second)
	_, err := validateJWT(token, secret)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestValidateJWT_WrongSecret(t *testing.T) {
	token, _ := issueJWT("123", "secret_a", 1*time.Hour)
	_, err := validateJWT(token, "secret_b")
	if err == nil {
		t.Fatal("expected error for wrong secret, got nil")
	}
}

// --- StateStore tests ---

func TestStateStore_GenerateAndConsume(t *testing.T) {
	s := newStateStore()
	doneURL := "http://127.0.0.1:54321/auth/done"
	state := s.Generate(doneURL)
	if state == "" {
		t.Fatal("state is empty")
	}
	got, ok := s.Consume(state)
	if !ok {
		t.Fatal("Consume returned ok=false")
	}
	if got != doneURL {
		t.Errorf("doneURL = %q, want %q", got, doneURL)
	}
}

func TestStateStore_ConsumeOnce(t *testing.T) {
	s := newStateStore()
	state := s.Generate("http://example.com")
	s.Consume(state)
	_, ok := s.Consume(state)
	if ok {
		t.Fatal("expected second Consume to fail (single-use)")
	}
}

func TestStateStore_InvalidState(t *testing.T) {
	s := newStateStore()
	_, ok := s.Consume("nonexistent_state")
	if ok {
		t.Fatal("expected ok=false for unknown state")
	}
}

// --- AvatarURL tests ---

func TestAvatarURL_WithHash(t *testing.T) {
	url := discordAvatarURL("123", "abc123hash", "0")
	want := "https://cdn.discordapp.com/avatars/123/abc123hash.png"
	if url != want {
		t.Errorf("avatarURL = %q, want %q", url, want)
	}
}

func TestAvatarURL_DefaultNewStyle(t *testing.T) {
	url := discordAvatarURL("1234567891234567890", "", "0")
	if url == "" {
		t.Fatal("expected non-empty URL")
	}
}
