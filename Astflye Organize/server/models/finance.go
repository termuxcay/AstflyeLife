package models

import "time"

type Transaction struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	UserID      string    `gorm:"index;not null" json:"user_id"`
	Type        string    `gorm:"not null" json:"type"`
	Amount      float64   `gorm:"not null" json:"amount"`
	Currency    string    `gorm:"default:BRL" json:"currency"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Recurring   bool      `gorm:"default:false" json:"recurring"`
	Frequency   string    `gorm:"default:once" json:"frequency"`
	Date        time.Time `json:"date"`
	CreatedAt   time.Time `json:"created_at"`
}
