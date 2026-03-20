package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/astflye/life/server/db"
	"github.com/astflye/life/server/handlers"
	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func setupFinanceApp(t *testing.T) (*fiber.App, string) {
	t.Helper()
	database, _ := db.Init(":memory:")
	userID := uuid.New().String()
	database.Create(&models.User{ID: userID, DiscordID: "disc-fin", Username: "FinUser"})

	app := fiber.New()
	h := handlers.NewFinanceHandler(database)
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("userID", userID)
		return c.Next()
	})
	app.Get("/finance/transactions", h.ListTransactions)
	app.Post("/finance/transactions", h.CreateTransaction)
	app.Put("/finance/transactions/:id", h.UpdateTransaction)
	app.Delete("/finance/transactions/:id", h.DeleteTransaction)
	app.Get("/finance/summary", h.Summary)
	app.Get("/finance/categories", h.Categories)
	return app, userID
}

func TestCreateTransaction_Income(t *testing.T) {
	app, _ := setupFinanceApp(t)
	body, _ := json.Marshal(map[string]interface{}{
		"type": "income", "amount": 5000.0, "category": "salary", "description": "Monthly salary",
	})
	req := httptest.NewRequest("POST", "/finance/transactions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	if resp.StatusCode != 201 {
		t.Errorf("expected 201, got %d", resp.StatusCode)
	}
}

func TestSummary_ReturnsBalance(t *testing.T) {
	app, _ := setupFinanceApp(t)
	incomeBody, _ := json.Marshal(map[string]interface{}{"type": "income", "amount": 1000.0, "category": "salary"})
	req := httptest.NewRequest("POST", "/finance/transactions", bytes.NewReader(incomeBody))
	req.Header.Set("Content-Type", "application/json")
	app.Test(req)

	expBody, _ := json.Marshal(map[string]interface{}{"type": "expense", "amount": 200.0, "category": "food"})
	req2 := httptest.NewRequest("POST", "/finance/transactions", bytes.NewReader(expBody))
	req2.Header.Set("Content-Type", "application/json")
	app.Test(req2)

	summaryReq := httptest.NewRequest("GET", "/finance/summary?period=all", nil)
	summaryResp, _ := app.Test(summaryReq)
	if summaryResp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", summaryResp.StatusCode)
	}
	var summary map[string]interface{}
	json.NewDecoder(summaryResp.Body).Decode(&summary)
	if summary["balance"].(float64) != 800.0 {
		t.Errorf("expected balance 800, got %v", summary["balance"])
	}
}
