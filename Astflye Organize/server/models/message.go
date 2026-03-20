package models

import "time"

type Message struct {
	ID         string     `gorm:"primaryKey" json:"id"`
	SenderID   string     `gorm:"index;not null" json:"sender_id"`
	ReceiverID string     `gorm:"index;not null" json:"receiver_id"`
	ChatType   string     `gorm:"not null" json:"chat_type"`
	Content    string     `gorm:"not null" json:"content"`
	ReadAt     *time.Time `json:"read_at"`
	CreatedAt  time.Time  `json:"created_at"`
}
