# Astflye Life — Phase 2: Tasks + Finance + Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full task management system (CRUD + recurrence + status transitions), financial system (transactions + summaries + charts), and a dashboard showing streak, daily progress, and balance — all behind JWT auth.

**Architecture:** Server-side handlers added to the existing Fiber app. Frontend pages added under `app/(dashboard)/`. All data fetched via TanStack Query through the existing `apiFetch` client.

**Tech Stack:** Go/Fiber (server), GORM/SQLite, Next.js 14, TanStack Query, Recharts, Zustand

**Prerequisite:** Phase 1 must be complete and all Phase 1 tests passing.

---

## File Map

### Server
| File | Responsibility |
|---|---|
| `server/handlers/tasks.go` | Task CRUD + status patch |
| `server/handlers/finance.go` | Transaction CRUD + summary + categories |
| `server/handlers/streak.go` | Streak update logic (called on task complete) |
| `server/main.go` | Register new route groups |

### Frontend
| File | Responsibility |
|---|---|
| `app/frontend/src/app/(dashboard)/page.tsx` | Dashboard with streak, progress, balance |
| `app/frontend/src/app/(dashboard)/tasks/page.tsx` | Task list page |
| `app/frontend/src/app/(dashboard)/tasks/new/page.tsx` | Create task form |
| `app/frontend/src/app/(dashboard)/finance/page.tsx` | Finance page with chart |
| `app/frontend/src/app/(dashboard)/finance/new/page.tsx` | Add transaction form |
| `app/frontend/src/components/tasks/TaskCard.tsx` | Single task card |
| `app/frontend/src/components/tasks/TaskFilters.tsx` | Status/category filter bar |
| `app/frontend/src/components/finance/TransactionRow.tsx` | Single transaction row |
| `app/frontend/src/components/finance/SummaryChart.tsx` | Recharts income vs expense |
| `app/frontend/src/hooks/useTasks.ts` | TanStack Query hooks for tasks |
| `app/frontend/src/hooks/useFinance.ts` | TanStack Query hooks for finance |
| `app/frontend/src/hooks/useMe.ts` | Current user + streak |

---

## Task 1: Task Handlers (Server)

**Files:**
- Create: `server/handlers/tasks.go`
- Create: `server/handlers/streak.go`
- Test: `server/handlers/tasks_test.go`

- [ ] **Step 1: Write failing tests**

Create `server/handlers/tasks_test.go`:
```go
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

func setupTaskApp(t *testing.T) (*fiber.App, *fiber.App, string) {
	t.Helper()
	database, _ := db.Init(":memory:")

	// Create a test user
	userID := uuid.New().String()
	database.Create(&models.User{ID: userID, DiscordID: "disc-1", Username: "TestUser"})

	app := fiber.New()
	h := handlers.NewTaskHandler(database)

	// Inject userID via locals (simulates JWT middleware)
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("userID", userID)
		return c.Next()
	})
	app.Get("/tasks", h.List)
	app.Post("/tasks", h.Create)
	app.Put("/tasks/:id", h.Update)
	app.Delete("/tasks/:id", h.Delete)
	app.Patch("/tasks/:id/status", h.UpdateStatus)

	return app, app, userID
}

func TestTaskCreate(t *testing.T) {
	app, _, _ := setupTaskApp(t)
	body, _ := json.Marshal(map[string]interface{}{
		"title":      "Morning workout",
		"priority":   "high",
		"recurrence": "daily",
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
	app, _, _ := setupTaskApp(t)
	req := httptest.NewRequest("GET", "/tasks", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var tasks []models.Task
	json.NewDecoder(resp.Body).Decode(&tasks)
	if len(tasks) != 0 {
		t.Errorf("expected empty list, got %d tasks", len(tasks))
	}
}

func TestTaskUpdateStatus_Complete(t *testing.T) {
	app, _, userID := setupTaskApp(t)
	_ = userID

	// Create a task first
	createBody, _ := json.Marshal(map[string]string{"title": "Test task"})
	createReq := httptest.NewRequest("POST", "/tasks", bytes.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createResp, _ := app.Test(createReq)
	var task models.Task
	json.NewDecoder(createResp.Body).Decode(&task)

	// Update status
	statusBody, _ := json.Marshal(map[string]string{"status": "completed"})
	statusReq := httptest.NewRequest("PATCH", "/tasks/"+task.ID+"/status", bytes.NewReader(statusBody))
	statusReq.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(statusReq)
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -run TestTask -v
```

- [ ] **Step 3: Implement handlers/tasks.go**

Create `server/handlers/tasks.go`:
```go
package handlers

import (
	"time"

	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaskHandler struct{ db *gorm.DB }

func NewTaskHandler(db *gorm.DB) *TaskHandler { return &TaskHandler{db: db} }

func (h *TaskHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	query := h.db.Where("user_id = ?", userID)
	if s := c.Query("status"); s != "" {
		query = query.Where("status = ?", s)
	}
	if r := c.Query("recurrence"); r != "" {
		query = query.Where("recurrence = ?", r)
	}
	if cat := c.Query("category"); cat != "" {
		query = query.Where("category = ?", cat)
	}
	var tasks []models.Task
	query.Order("created_at desc").Find(&tasks)
	return c.JSON(tasks)
}

func (h *TaskHandler) Create(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body models.Task
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "title is required"})
	}
	body.ID = uuid.New().String()
	body.UserID = userID
	if body.Status == "" {
		body.Status = "pending"
	}
	if body.Priority == "" {
		body.Priority = "medium"
	}
	if body.Recurrence == "" {
		body.Recurrence = "none"
	}
	body.CreatedAt = time.Now()
	h.db.Create(&body)
	return c.Status(201).JSON(body)
}

func (h *TaskHandler) Update(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var task models.Task
	if err := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).First(&task).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "task not found"})
	}
	var updates models.Task
	c.BodyParser(&updates)
	h.db.Model(&task).Updates(updates)
	return c.JSON(task)
}

func (h *TaskHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	result := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).Delete(&models.Task{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "task not found"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *TaskHandler) UpdateStatus(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var task models.Task
	if err := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).First(&task).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "task not found"})
	}
	var body struct{ Status string `json:"status"` }
	if err := c.BodyParser(&body); err != nil || body.Status == "" {
		return c.Status(400).JSON(fiber.Map{"error": "status required"})
	}
	updates := map[string]interface{}{"status": body.Status}
	if body.Status == "completed" {
		now := time.Now()
		updates["completed_at"] = now
		// Update streak
		go UpdateStreak(h.db, userID)
	}
	h.db.Model(&task).Updates(updates)
	h.db.First(&task, "id = ?", task.ID)
	return c.JSON(task)
}
```

Create `server/handlers/streak.go`:
```go
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
			return // already counted today
		}
		yesterday := today.AddDate(0, 0, -1)
		if last.Equal(yesterday) {
			user.CurrentStreak++
		} else {
			user.CurrentStreak = 1 // streak broken
		}
	} else {
		user.CurrentStreak = 1
	}

	if user.CurrentStreak > user.LongestStreak {
		user.LongestStreak = user.CurrentStreak
	}

	db.Model(&user).Updates(map[string]interface{}{
		"current_streak":   user.CurrentStreak,
		"longest_streak":   user.LongestStreak,
		"last_active_date": time.Now(),
	})
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -run TestTask -v
```

- [ ] **Step 5: Register task routes in main.go**

Edit `server/main.go` — add after `api.Get("/users/:id", ...)`:
```go
taskHandler := handlers.NewTaskHandler(database)
api.Get("/tasks", taskHandler.List)
api.Post("/tasks", taskHandler.Create)
api.Put("/tasks/:id", taskHandler.Update)
api.Delete("/tasks/:id", taskHandler.Delete)
api.Patch("/tasks/:id/status", taskHandler.UpdateStatus)
```

- [ ] **Step 6: Commit**

```bash
git add server/handlers/tasks.go server/handlers/streak.go server/handlers/tasks_test.go server/main.go
git commit -m "feat(server): task CRUD + status transitions + streak update"
```

---

## Task 2: Finance Handlers (Server)

**Files:**
- Create: `server/handlers/finance.go`
- Test: `server/handlers/finance_test.go`

- [ ] **Step 1: Write failing tests**

Create `server/handlers/finance_test.go`:
```go
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
	// Add income
	incomeBody, _ := json.Marshal(map[string]interface{}{"type": "income", "amount": 1000.0, "category": "salary"})
	req := httptest.NewRequest("POST", "/finance/transactions", bytes.NewReader(incomeBody))
	req.Header.Set("Content-Type", "application/json")
	app.Test(req)

	// Add expense
	expBody, _ := json.Marshal(map[string]interface{}{"type": "expense", "amount": 200.0, "category": "food"})
	req2 := httptest.NewRequest("POST", "/finance/transactions", bytes.NewReader(expBody))
	req2.Header.Set("Content-Type", "application/json")
	app.Test(req2)

	// Get summary
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
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -run TestCreateTransaction -v
```

- [ ] **Step 3: Implement finance.go**

Create `server/handlers/finance.go`:
```go
package handlers

import (
	"time"

	"github.com/astflye/life/server/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FinanceHandler struct{ db *gorm.DB }

func NewFinanceHandler(db *gorm.DB) *FinanceHandler { return &FinanceHandler{db: db} }

func (h *FinanceHandler) ListTransactions(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	query := h.db.Where("user_id = ?", userID)
	if t := c.Query("type"); t != "" {
		query = query.Where("type = ?", t)
	}
	if cat := c.Query("category"); cat != "" {
		query = query.Where("category = ?", cat)
	}
	var txs []models.Transaction
	query.Order("date desc").Find(&txs)
	return c.JSON(txs)
}

func (h *FinanceHandler) CreateTransaction(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var body models.Transaction
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.Type == "" || body.Amount <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "type and amount required"})
	}
	body.ID = uuid.New().String()
	body.UserID = userID
	if body.Currency == "" {
		body.Currency = "BRL"
	}
	if body.Date.IsZero() {
		body.Date = time.Now()
	}
	body.CreatedAt = time.Now()
	h.db.Create(&body)
	return c.Status(201).JSON(body)
}

func (h *FinanceHandler) UpdateTransaction(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var tx models.Transaction
	if err := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).First(&tx).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "transaction not found"})
	}
	var updates models.Transaction
	c.BodyParser(&updates)
	h.db.Model(&tx).Updates(updates)
	return c.JSON(tx)
}

func (h *FinanceHandler) DeleteTransaction(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	result := h.db.Where("id = ? AND user_id = ?", c.Params("id"), userID).Delete(&models.Transaction{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *FinanceHandler) Summary(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	query := h.db.Model(&models.Transaction{}).Where("user_id = ?", userID)

	period := c.Query("period", "monthly")
	now := time.Now()
	switch period {
	case "daily":
		query = query.Where("date >= ?", now.Truncate(24*time.Hour))
	case "weekly":
		query = query.Where("date >= ?", now.AddDate(0, 0, -7))
	case "monthly":
		query = query.Where("date >= ?", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local))
	case "yearly":
		query = query.Where("date >= ?", time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.Local))
	}

	var income, expenses float64
	query.Where("type = 'income'").Select("COALESCE(SUM(amount), 0)").Scan(&income)
	query.Where("type = 'expense'").Select("COALESCE(SUM(amount), 0)").Scan(&expenses)

	return c.JSON(fiber.Map{
		"income":   income,
		"expenses": expenses,
		"balance":  income - expenses,
		"period":   period,
	})
}

func (h *FinanceHandler) Categories(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	var results []struct {
		Category string  `json:"category"`
		Total    float64 `json:"total"`
		Count    int     `json:"count"`
	}
	h.db.Model(&models.Transaction{}).
		Where("user_id = ? AND type = 'expense'", userID).
		Select("category, SUM(amount) as total, COUNT(*) as count").
		Group("category").
		Order("total desc").
		Scan(&results)
	return c.JSON(results)
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./handlers/... -run TestCreateTransaction -run TestSummary -v
```

- [ ] **Step 5: Register finance routes in main.go**

Add to `server/main.go` after task routes:
```go
financeHandler := handlers.NewFinanceHandler(database)
api.Get("/finance/transactions", financeHandler.ListTransactions)
api.Post("/finance/transactions", financeHandler.CreateTransaction)
api.Put("/finance/transactions/:id", financeHandler.UpdateTransaction)
api.Delete("/finance/transactions/:id", financeHandler.DeleteTransaction)
api.Get("/finance/summary", financeHandler.Summary)
api.Get("/finance/categories", financeHandler.Categories)
```

- [ ] **Step 6: Commit**

```bash
git add server/handlers/finance.go server/handlers/finance_test.go server/main.go
git commit -m "feat(server): finance CRUD + summary + category breakdown"
```

---

## Task 3: Frontend Query Hooks

**Files:**
- Create: `app/frontend/src/hooks/useTasks.ts`
- Create: `app/frontend/src/hooks/useFinance.ts`
- Create: `app/frontend/src/hooks/useMe.ts`

- [ ] **Step 1: Setup TanStack Query provider**

Edit `app/frontend/app/layout.tsx` to wrap with QueryClientProvider:
```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create hooks**

Create `app/frontend/src/hooks/useMe.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface User {
  id: string
  username: string
  avatar: string
  current_streak: number
  longest_streak: number
}

export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => apiFetch('/users/me'),
    staleTime: 5 * 60 * 1000,
  })
}
```

Create `app/frontend/src/hooks/useTasks.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'completed' | 'skipped' | 'in_progress'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category?: string
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  due_date?: string
  completed_at?: string
  created_at: string
}

export function useTasks(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters).toString()
  return useQuery<Task[]>({
    queryKey: ['tasks', filters],
    queryFn: () => apiFetch(`/tasks${params ? '?' + params : ''}`),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Task>) => apiFetch('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['me'] }) // streak may have updated
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
```

Create `app/frontend/src/hooks/useFinance.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category: string
  description?: string
  recurring: boolean
  date: string
  created_at: string
}

export interface Summary {
  income: number
  expenses: number
  balance: number
  period: string
}

export function useTransactions(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters).toString()
  return useQuery<Transaction[]>({
    queryKey: ['transactions', filters],
    queryFn: () => apiFetch(`/finance/transactions${params ? '?' + params : ''}`),
  })
}

export function useSummary(period = 'monthly') {
  return useQuery<Summary>({
    queryKey: ['summary', period],
    queryFn: () => apiFetch(`/finance/summary?period=${period}`),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch('/finance/categories'),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Transaction>) =>
      apiFetch('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/finance/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/hooks/ app/frontend/app/layout.tsx
git commit -m "feat(app): TanStack Query hooks for tasks, finance, user"
```

---

## Task 4: Task UI Pages

**Files:**
- Create: `app/frontend/src/components/tasks/TaskCard.tsx`
- Create: `app/frontend/src/app/(dashboard)/tasks/page.tsx`
- Create: `app/frontend/src/app/(dashboard)/tasks/new/page.tsx`

- [ ] **Step 1: Write failing component test**

Create `app/frontend/src/__tests__/TaskCard.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskCard } from '@/components/tasks/TaskCard'

const mockTask = {
  id: '1', title: 'Morning workout', status: 'pending' as const,
  priority: 'high' as const, recurrence: 'daily' as const, created_at: '',
}

test('renders task title', () => {
  render(<TaskCard task={mockTask} onStatusChange={jest.fn()} onDelete={jest.fn()} />)
  expect(screen.getByText('Morning workout')).toBeInTheDocument()
})

test('calls onStatusChange when complete clicked', () => {
  const onStatusChange = jest.fn()
  render(<TaskCard task={mockTask} onStatusChange={onStatusChange} onDelete={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /complete/i }))
  expect(onStatusChange).toHaveBeenCalledWith('1', 'completed')
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test -- --testPathPattern=TaskCard
```

- [ ] **Step 3: Implement TaskCard**

Create `app/frontend/src/components/tasks/TaskCard.tsx`:
```tsx
'use client'
import type { Task } from '@/hooks/useTasks'

const priorityColors = {
  low: '#555577', medium: '#776688', high: '#b455ff', urgent: '#ff55aa',
}
const statusColors = {
  pending: '#776688', in_progress: '#b455ff', completed: '#00cc77', skipped: '#444',
}

interface Props {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}

export function TaskCard({ task, onStatusChange, onDelete }: Props) {
  const isCompleted = task.status === 'completed'
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg transition-all"
      style={{
        background: '#110820',
        border: `1px solid ${isCompleted ? '#00cc7733' : '#b455ff22'}`,
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      {/* Status circle */}
      <button
        aria-label="complete"
        onClick={() => onStatusChange(task.id, isCompleted ? 'pending' : 'completed')}
        className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all"
        style={{
          borderColor: statusColors[task.status] ?? '#776688',
          background: isCompleted ? '#00cc77' : 'transparent',
        }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{
            color: '#e0d0ff',
            textDecoration: isCompleted ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: priorityColors[task.priority] + '33', color: priorityColors[task.priority] }}
          >
            {task.priority}
          </span>
          {task.recurrence !== 'none' && (
            <span className="text-xs" style={{ color: '#554466' }}>↻ {task.recurrence}</span>
          )}
        </div>
      </div>

      {/* Skip / Delete */}
      <div className="flex gap-1">
        {!isCompleted && (
          <button
            onClick={() => onStatusChange(task.id, 'skipped')}
            className="text-xs px-2 py-1 rounded opacity-40 hover:opacity-70"
            style={{ color: '#776688' }}
          >
            skip
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs px-2 py-1 rounded opacity-40 hover:opacity-70"
          style={{ color: '#ff4466' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm test -- --testPathPattern=TaskCard
```

- [ ] **Step 5: Create tasks page**

Create `app/frontend/app/(dashboard)/tasks/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useTasks, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks'
import { TaskCard } from '@/components/tasks/TaskCard'
import Link from 'next/link'

export default function TasksPage() {
  const [filter, setFilter] = useState<string | undefined>()
  const { data: tasks, isLoading } = useTasks(filter ? { status: filter } : undefined)
  const updateStatus = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()

  const filters = ['all', 'pending', 'in_progress', 'completed', 'skipped']

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#b455ff' }}>Tasks</h1>
        <Link
          href="/tasks/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}
        >
          + New Task
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f === 'all' ? undefined : f)}
            className="px-3 py-1 rounded-full text-xs capitalize transition-all"
            style={{
              background: (filter ?? 'all') === f ? '#b455ff33' : '#110820',
              border: `1px solid ${(filter ?? 'all') === f ? '#b455ff' : '#b455ff22'}`,
              color: (filter ?? 'all') === f ? '#e0d0ff' : '#776688',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && <p style={{ color: '#776688' }}>Loading...</p>}

      <div className="flex flex-col gap-2">
        {tasks?.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            onDelete={(id) => deleteTask.mutate(id)}
          />
        ))}
        {tasks?.length === 0 && (
          <p className="text-center py-10" style={{ color: '#554466' }}>
            No tasks yet. Create your first one!
          </p>
        )}
      </div>
    </div>
  )
}
```

Create `app/frontend/app/(dashboard)/tasks/new/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateTask } from '@/hooks/useTasks'

export default function NewTaskPage() {
  const router = useRouter()
  const createTask = useCreateTask()
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    recurrence: 'none', category: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTask.mutateAsync(form)
    router.push('/tasks')
  }

  const inputStyle = {
    background: '#1a0d2e', border: '1px solid #b455ff33',
    borderRadius: 8, padding: '8px 12px', color: '#e0d0ff',
    width: '100%', outline: 'none',
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#b455ff' }}>New Task</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>TITLE *</label>
          <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>DESCRIPTION</label>
          <textarea style={{ ...inputStyle, minHeight: 80 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: '#776688' }}>PRIORITY</label>
            <select style={inputStyle} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: '#776688' }}>RECURRENCE</label>
            <select style={inputStyle} value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
              {['none', 'daily', 'weekly', 'monthly', 'yearly'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>CATEGORY</label>
          <input style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. health, work, personal" />
        </div>
        <button
          type="submit"
          disabled={createTask.isPending}
          className="py-3 rounded-lg font-semibold text-white mt-2"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}
        >
          {createTask.isPending ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/frontend/src/components/tasks/ app/frontend/app/\(dashboard\)/tasks/
git commit -m "feat(app): task list + create form + TaskCard component"
```

---

## Task 5: Finance UI + Charts

**Files:**
- Create: `app/frontend/src/components/finance/SummaryChart.tsx`
- Create: `app/frontend/src/components/finance/TransactionRow.tsx`
- Create: `app/frontend/src/app/(dashboard)/finance/page.tsx`
- Create: `app/frontend/src/app/(dashboard)/finance/new/page.tsx`

- [ ] **Step 1: Create SummaryChart**

Create `app/frontend/src/components/finance/SummaryChart.tsx`:
```tsx
'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

interface Props {
  data: { name: string; income: number; expenses: number }[]
}

export function SummaryChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#b455ff11" />
        <XAxis dataKey="name" tick={{ fill: '#776688', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#776688', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#110820', border: '1px solid #b455ff33', borderRadius: 8 }}
          labelStyle={{ color: '#b455ff' }}
          itemStyle={{ color: '#e0d0ff' }}
        />
        <Bar dataKey="income" fill="#b455ff" radius={[4,4,0,0]} />
        <Bar dataKey="expenses" fill="#ff55aa" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

Create `app/frontend/src/components/finance/TransactionRow.tsx`:
```tsx
'use client'
import type { Transaction } from '@/hooks/useFinance'

interface Props {
  tx: Transaction
  onDelete: (id: string) => void
}

export function TransactionRow({ tx, onDelete }: Props) {
  const isIncome = tx.type === 'income'
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg"
      style={{ background: '#110820', border: '1px solid #b455ff11' }}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: isIncome ? '#b455ff22' : '#ff55aa22' }}
      >
        {isIncome ? '↑' : '↓'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#e0d0ff' }}>
          {tx.description || tx.category}
        </p>
        <p className="text-xs" style={{ color: '#554466' }}>{tx.category}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold"
          style={{ color: isIncome ? '#b455ff' : '#ff55aa' }}>
          {isIncome ? '+' : '-'}R$ {tx.amount.toFixed(2)}
        </p>
        <p className="text-xs" style={{ color: '#554466' }}>
          {new Date(tx.date).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <button onClick={() => onDelete(tx.id)}
        className="text-xs opacity-30 hover:opacity-70 ml-2"
        style={{ color: '#ff4466' }}>✕</button>
    </div>
  )
}
```

- [ ] **Step 2: Create finance page**

Create `app/frontend/app/(dashboard)/finance/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useTransactions, useSummary, useDeleteTransaction } from '@/hooks/useFinance'
import { TransactionRow } from '@/components/finance/TransactionRow'
import { SummaryChart } from '@/components/finance/SummaryChart'
import Link from 'next/link'

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly']

export default function FinancePage() {
  const [period, setPeriod] = useState('monthly')
  const { data: transactions } = useTransactions()
  const { data: summary } = useSummary(period)
  const deleteTransaction = useDeleteTransaction()

  // Build chart data from last 7 entries grouped by type
  const chartData = [{ name: period, income: summary?.income ?? 0, expenses: summary?.expenses ?? 0 }]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#b455ff' }}>Finance</h1>
        <Link href="/finance/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}>
          + Add
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Income', value: summary?.income ?? 0, color: '#b455ff' },
          { label: 'Expenses', value: summary?.expenses ?? 0, color: '#ff55aa' },
          { label: 'Balance', value: summary?.balance ?? 0, color: (summary?.balance ?? 0) >= 0 ? '#00cc77' : '#ff4466' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-xl"
            style={{ background: '#110820', border: '1px solid #b455ff22' }}>
            <p className="text-xs mb-1" style={{ color: '#554466' }}>{label}</p>
            <p className="text-lg font-bold" style={{ color }}>
              R$ {value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Period filter */}
      <div className="flex gap-2 mb-4">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className="px-3 py-1 rounded-full text-xs capitalize"
            style={{
              background: period === p ? '#b455ff33' : '#110820',
              border: `1px solid ${period === p ? '#b455ff' : '#b455ff22'}`,
              color: period === p ? '#e0d0ff' : '#776688',
            }}>
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="mb-6 p-4 rounded-xl" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
        <SummaryChart data={chartData} />
      </div>

      {/* Transactions */}
      <div className="flex flex-col gap-2">
        {transactions?.map(tx => (
          <TransactionRow key={tx.id} tx={tx} onDelete={(id) => deleteTransaction.mutate(id)} />
        ))}
        {transactions?.length === 0 && (
          <p className="text-center py-10" style={{ color: '#554466' }}>
            No transactions yet.
          </p>
        )}
      </div>
    </div>
  )
}
```

Create `app/frontend/app/(dashboard)/finance/new/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateTransaction } from '@/hooks/useFinance'

const CATEGORIES = {
  income: ['salary', 'freelance', 'investment', 'gift', 'other'],
  expense: ['food', 'transport', 'health', 'entertainment', 'bills', 'education', 'other'],
}

export default function NewTransactionPage() {
  const router = useRouter()
  const createTx = useCreateTransaction()
  const [form, setForm] = useState({ type: 'expense', amount: '', category: 'food', description: '', recurring: false, frequency: 'once' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTx.mutateAsync({ ...form, amount: parseFloat(form.amount) })
    router.push('/finance')
  }

  const inputStyle = { background: '#1a0d2e', border: '1px solid #b455ff33', borderRadius: 8, padding: '8px 12px', color: '#e0d0ff', width: '100%' }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#b455ff' }}>Add Transaction</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {['income', 'expense'].map(t => (
            <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
              className="py-2 rounded-lg text-sm capitalize font-medium transition-all"
              style={{
                background: form.type === t ? (t === 'income' ? '#b455ff33' : '#ff55aa33') : '#110820',
                border: `1px solid ${form.type === t ? (t === 'income' ? '#b455ff' : '#ff55aa') : '#b455ff22'}`,
                color: form.type === t ? '#e0d0ff' : '#776688',
              }}>
              {t === 'income' ? '↑ Income' : '↓ Expense'}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>AMOUNT (R$) *</label>
          <input style={inputStyle} type="number" step="0.01" min="0.01" value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>CATEGORY</label>
          <select style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {(CATEGORIES[form.type as keyof typeof CATEGORIES] ?? []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>DESCRIPTION</label>
          <input style={inputStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <button type="submit" disabled={createTx.isPending}
          className="py-3 rounded-lg font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}>
          {createTx.isPending ? 'Adding...' : 'Add Transaction'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/frontend/src/components/finance/ app/frontend/app/\(dashboard\)/finance/
git commit -m "feat(app): finance pages + SummaryChart + TransactionRow"
```

---

## Task 6: Dashboard Page

**Files:**
- Modify: `app/frontend/src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Update dashboard with real widgets**

Replace `app/frontend/app/(dashboard)/page.tsx`:
```tsx
'use client'
import { useMe } from '@/hooks/useMe'
import { useTasks } from '@/hooks/useTasks'
import { useSummary } from '@/hooks/useFinance'

export default function DashboardPage() {
  const { data: me } = useMe()
  const { data: todayTasks } = useTasks({ recurrence: 'daily' })
  const { data: summary } = useSummary('monthly')

  const completed = todayTasks?.filter(t => t.status === 'completed').length ?? 0
  const total = todayTasks?.length ?? 0
  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#b455ff' }}>
          Hey, {me?.username ?? '...'} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: '#776688' }}>Here's your day at a glance.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
          <p className="text-xs" style={{ color: '#554466' }}>STREAK</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#b455ff' }}>
            {me?.current_streak ?? 0}
          </p>
          <p className="text-xs" style={{ color: '#554466' }}>days</p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
          <p className="text-xs" style={{ color: '#554466' }}>TODAY</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#ff55aa' }}>
            {completed}/{total}
          </p>
          <p className="text-xs" style={{ color: '#554466' }}>tasks done</p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
          <p className="text-xs" style={{ color: '#554466' }}>BALANCE</p>
          <p className="text-2xl font-bold mt-1" style={{ color: (summary?.balance ?? 0) >= 0 ? '#00cc77' : '#ff4466' }}>
            R${((summary?.balance ?? 0) / 1000).toFixed(1)}k
          </p>
          <p className="text-xs" style={{ color: '#554466' }}>this month</p>
        </div>
      </div>

      {/* Daily progress bar */}
      <div className="p-4 rounded-xl" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
        <div className="flex justify-between mb-2">
          <span className="text-xs" style={{ color: '#776688' }}>DAILY PROGRESS</span>
          <span className="text-xs font-bold" style={{ color: '#b455ff' }}>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a0d2e' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #b455ff, #ff55aa)',
              boxShadow: '0 0 8px #b455ff',
            }}
          />
        </div>
        {progress === 100 && (
          <p className="text-xs mt-2 text-center" style={{ color: '#b455ff' }}>
            🔥 All done! You crushed today.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build frontend**

```bash
cd "c:/! A1/Astflye Organize/app/frontend" && npm run build
```
Expected: success, `out/` updated.

- [ ] **Step 3: Run all tests**

```bash
cd "c:/! A1/Astflye Organize/server" && go test ./... -v
cd "c:/! A1/Astflye Organize/app/frontend" && npm test
```

- [ ] **Step 4: Phase 2 final commit**

```bash
cd "c:/! A1/Astflye Organize"
git add .
git commit -m "feat: Phase 2 complete — tasks, finance, dashboard with streak + progress + balance"
```
