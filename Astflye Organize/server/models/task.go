package models

import "time"

type Task struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	UserID      string     `gorm:"index;not null" json:"user_id"`
	Title       string     `gorm:"not null" json:"title"`
	Description string     `json:"description"`
	Status      string     `gorm:"default:pending" json:"status"`
	Priority    string     `gorm:"default:medium" json:"priority"`
	Category    string     `json:"category"`
	Tags        string     `json:"tags"`
	Recurrence  string     `gorm:"default:none" json:"recurrence"`
	DueDate     time.Time  `json:"due_date"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}
