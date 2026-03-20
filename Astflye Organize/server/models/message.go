package models

import "time"

type Message struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	TeamID    string    `gorm:"index;not null" json:"team_id"`
	SenderID  string    `gorm:"index;not null" json:"sender_id"`
	Content   string    `gorm:"not null" json:"content"`
	CreatedAt time.Time `json:"created_at"`
}
