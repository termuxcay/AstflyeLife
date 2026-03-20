package db_test

import (
	"testing"
	"github.com/astflye/life/server/db"
)

func TestInit_CreatesTablesInMemory(t *testing.T) {
	database, err := db.Init(":memory:")
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	if database == nil {
		t.Fatal("expected non-nil db")
	}
	migrator := database.Migrator()
	tables := []string{"users", "tasks", "transactions", "messages", "teams", "team_members", "refresh_tokens", "friendships"}
	for _, table := range tables {
		if !migrator.HasTable(table) {
			t.Errorf("expected table %q to exist after migration", table)
		}
	}
}
