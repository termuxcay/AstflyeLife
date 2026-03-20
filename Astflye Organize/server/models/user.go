package models

import "time"

type User struct {
	ID             string     `gorm:"primaryKey" json:"id"`
	DiscordID      string     `gorm:"uniqueIndex;not null" json:"discord_id"`
	Username       string     `gorm:"not null" json:"username"`
	Avatar         string     `json:"avatar"`
	CurrentStreak  int        `gorm:"default:0" json:"current_streak"`
	LongestStreak  int        `gorm:"default:0" json:"longest_streak"`
	LastActiveDate *time.Time `json:"last_active_date"`
	CreatedAt      time.Time  `json:"created_at"`
}
