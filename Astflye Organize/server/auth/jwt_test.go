package auth_test

import (
	"testing"
	"time"
	"github.com/astflye/life/server/auth"
)

const testSecret = "test-secret-key-that-is-32-bytes!"
const testRefreshSecret = "test-refresh-key-that-is-32-bytes"

func TestIssueAndValidateAccessToken(t *testing.T) {
	token, err := auth.IssueAccessToken("user-123", testSecret)
	if err != nil {
		t.Fatalf("IssueAccessToken failed: %v", err)
	}

	userID, err := auth.ValidateAccessToken(token, testSecret)
	if err != nil {
		t.Fatalf("ValidateAccessToken failed: %v", err)
	}
	if userID != "user-123" {
		t.Errorf("expected user-123, got %s", userID)
	}
}

func TestValidateAccessToken_Expired(t *testing.T) {
	token, err := auth.IssueAccessTokenWithExpiry("user-123", testSecret, -time.Hour)
	if err != nil {
		t.Fatalf("IssueAccessTokenWithExpiry failed: %v", err)
	}
	_, err = auth.ValidateAccessToken(token, testSecret)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestIssueRefreshToken_UniqueEachCall(t *testing.T) {
	t1, _ := auth.IssueRawRefreshToken()
	t2, _ := auth.IssueRawRefreshToken()
	if t1 == t2 {
		t.Error("refresh tokens should be unique")
	}
}
