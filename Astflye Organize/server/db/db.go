package db

import (
	"os"
	"path/filepath"

	"github.com/astflye/life/server/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Init(dsn string) (*gorm.DB, error) {
	if dsn != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(dsn), 0755); err != nil {
			return nil, err
		}
	}

	database, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = database.AutoMigrate(
		&models.User{},
		&models.Task{},
		&models.Transaction{},
		&models.Message{},
		&models.Team{},
		&models.TeamMember{},
		&models.Friendship{},
		&models.RefreshToken{},
	)
	return database, err
}
