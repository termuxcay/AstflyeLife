package handlers

import (
	"time"

	"github.com/astflye/life/server/models"
	"gorm.io/gorm"
)

func UpdateStreak(db *gorm.DB, userID string) {
	var user models.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		return
	}

	today := time.Now().Truncate(24 * time.Hour)

	if user.LastActiveDate != nil {
		last := user.LastActiveDate.Truncate(24 * time.Hour)
		if last.Equal(today) {
			return
		}
		yesterday := today.AddDate(0, 0, -1)
		if last.Equal(yesterday) {
			user.CurrentStreak++
		} else {
			user.CurrentStreak = 1
		}
	} else {
		user.CurrentStreak = 1
	}

	if user.CurrentStreak > user.LongestStreak {
		user.LongestStreak = user.CurrentStreak
	}

	now := time.Now()
	db.Model(&user).Updates(map[string]interface{}{
		"current_streak":   user.CurrentStreak,
		"longest_streak":   user.LongestStreak,
		"last_active_date": now,
	})
}
