package models

import "time"

type Team struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description"`
	OwnerID     string    `gorm:"not null" json:"owner_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type TeamMember struct {
	TeamID   string    `gorm:"primaryKey" json:"team_id"`
	UserID   string    `gorm:"primaryKey" json:"user_id"`
	Role     string    `gorm:"default:member" json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

type Friendship struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index;not null" json:"user_id"`
	FriendID  string    `gorm:"index;not null" json:"friend_id"`
	Status    string    `gorm:"default:pending" json:"status"`
	CreatedAt time.Time `json:"created_at"`
}
