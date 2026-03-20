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

func setupTaskApp(t *testing.T) (*fiber.App, string) {
	t.Helper()
	database, _ := db.Init(":memory:")
	userID := uuid.New().String()
	database.Create(&models.User{ID: userID, DiscordID: "disc-1", Username: "TestUser"})

	app := fiber.New()
	h := handlers.NewTaskHandler(database)
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("userID", userID)
		return c.Next()
	})
	app.Get("/tasks", h.List)
	app.Post("/tasks", h.Create)
	app.Put("/tasks/:id", h.Update)
	app.Delete("/tasks/:id", h.Delete)
	app.Patch("/tasks/:id/status", h.UpdateStatus)
	return app, userID
}

func TestTaskCreate(t *testing.T) {
	app, _ := setupTaskApp(t)
	body, _ := json.Marshal(map[string]interface{}{
		"title": "Morning workout", "priority": "high", "recurrence": "daily",
	})
	req := httptest.NewRequest("POST", "/tasks", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	if resp.StatusCode != 201 {
		t.Errorf("expected 201, got %d", resp.StatusCode)
	}
	var task models.Task
	json.NewDecoder(resp.Body).Decode(&task)
	if task.Title != "Morning workout" {
		t.Errorf("expected title 'Morning workout', got %s", task.Title)
	}
}

func TestTaskList_Empty(t *testing.T) {
	app, _ := setupTaskApp(t)
	req := httptest.NewRequest("GET", "/tasks", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var tasks []models.Task
	json.NewDecoder(resp.Body).Decode(&tasks)
	if len(tasks) != 0 {
		t.Errorf("expected empty list, got %d", len(tasks))
	}
}

func TestTaskUpdateStatus_Complete(t *testing.T) {
	app, _ := setupTaskApp(t)
	createBody, _ := json.Marshal(map[string]string{"title": "Test task"})
	createReq := httptest.NewRequest("POST", "/tasks", bytes.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createResp, _ := app.Test(createReq)
	var task models.Task
	json.NewDecoder(createResp.Body).Decode(&task)

	statusBody, _ := json.Marshal(map[string]string{"status": "completed"})
	statusReq := httptest.NewRequest("PATCH", "/tasks/"+task.ID+"/status", bytes.NewReader(statusBody))
	statusReq.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(statusReq)
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}
