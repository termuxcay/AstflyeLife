package auth_test

import (
	"testing"
	"github.com/astflye/life/server/auth"
)

func TestStateStore_SetAndValidate(t *testing.T) {
	store := auth.NewStateStore()
	state := store.Generate()

	if !store.Validate(state) {
		t.Error("expected valid state to pass validation")
	}
	// second validation should fail (state consumed)
	if store.Validate(state) {
		t.Error("expected state to be consumed after first validation")
	}
}

func TestStateStore_InvalidState(t *testing.T) {
	store := auth.NewStateStore()
	if store.Validate("bogus-state") {
		t.Error("expected invalid state to fail validation")
	}
}
