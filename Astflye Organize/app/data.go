package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ─── Structs ──────────────────────────────────────────────────────────────────

type Task struct {
	ID            string `json:"id"`
	UserDiscordID string `json:"user_discord_id"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Status        string `json:"status"`
	Priority      string `json:"priority"`
	Category      string `json:"category"`
	Recurrence    string `json:"recurrence"`
	DueDate       string `json:"due_date"`
	CompletedAt   string `json:"completed_at"`
	CreatedAt     string `json:"created_at"`
}

type TaskInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	Category    string `json:"category"`
	Recurrence  string `json:"recurrence"`
	DueDate     string `json:"due_date"`
}

type Transaction struct {
	ID            string  `json:"id"`
	UserDiscordID string  `json:"user_discord_id"`
	Type          string  `json:"type"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Category      string  `json:"category"`
	Description   string  `json:"description"`
	Recurring     bool    `json:"recurring"`
	Date          string  `json:"date"`
	CreatedAt     string  `json:"created_at"`
}

type TransactionInput struct {
	Type        string  `json:"type"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
	Recurring   bool    `json:"recurring"`
	Date        string  `json:"date"`
}

type FinanceSummary struct {
	Income   float64 `json:"income"`
	Expenses float64 `json:"expenses"`
	Balance  float64 `json:"balance"`
	Period   string  `json:"period"`
}

// ─── File helpers ─────────────────────────────────────────────────────────────

var (
	taskMu sync.RWMutex
	txMu   sync.RWMutex
)

func readJSON[T any](path string) ([]T, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return []T{}, nil
	}
	if err != nil {
		return []T{}, nil
	}
	var items []T
	if err := json.Unmarshal(data, &items); err != nil {
		return []T{}, nil // corrupt file → empty
	}
	return items, nil
}

func writeJSON[T any](path string, items []T) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func tasksPath(dir string) string       { return filepath.Join(dir, "tasks.json") }
func transactionsPath(dir string) string { return filepath.Join(dir, "finance.json") }

// ─── Tasks CRUD ───────────────────────────────────────────────────────────────

func getTasks(dir, discordID string) ([]Task, error) {
	taskMu.RLock()
	all, err := readJSON[Task](tasksPath(dir))
	taskMu.RUnlock()
	if err != nil {
		return nil, err
	}
	out := []Task{}
	for _, t := range all {
		if t.UserDiscordID == discordID {
			out = append(out, t)
		}
	}
	return out, nil
}

func createTask(dir, discordID string, in TaskInput) (Task, error) {
	taskMu.Lock()
	defer taskMu.Unlock()

	all, _ := readJSON[Task](tasksPath(dir))
	priority := in.Priority
	if priority == "" {
		priority = "medium"
	}
	recurrence := in.Recurrence
	if recurrence == "" {
		recurrence = "none"
	}
	t := Task{
		ID:            uuid.New().String(),
		UserDiscordID: discordID,
		Title:         in.Title,
		Description:   in.Description,
		Status:        "pending",
		Priority:      priority,
		Category:      in.Category,
		Recurrence:    recurrence,
		DueDate:       in.DueDate,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	all = append(all, t)
	return t, writeJSON(tasksPath(dir), all)
}

func updateTask(dir, discordID, id string, in TaskInput) error {
	taskMu.Lock()
	defer taskMu.Unlock()

	all, _ := readJSON[Task](tasksPath(dir))
	for i, t := range all {
		if t.ID == id && t.UserDiscordID == discordID {
			all[i].Title = in.Title
			all[i].Description = in.Description
			all[i].Priority = in.Priority
			all[i].Category = in.Category
			all[i].Recurrence = in.Recurrence
			all[i].DueDate = in.DueDate
			if in.Status != "" {
				all[i].Status = in.Status
			}
			return writeJSON(tasksPath(dir), all)
		}
	}
	return nil
}

func updateTaskStatus(dir, discordID, id, status string) error {
	taskMu.Lock()
	defer taskMu.Unlock()

	all, _ := readJSON[Task](tasksPath(dir))
	for i, t := range all {
		if t.ID == id && t.UserDiscordID == discordID {
			all[i].Status = status
			if status == "completed" {
				all[i].CompletedAt = time.Now().UTC().Format(time.RFC3339)
			}
			return writeJSON(tasksPath(dir), all)
		}
	}
	return nil
}

func deleteTask(dir, discordID, id string) error {
	taskMu.Lock()
	defer taskMu.Unlock()

	all, _ := readJSON[Task](tasksPath(dir))
	filtered := all[:0]
	for _, t := range all {
		if !(t.ID == id && t.UserDiscordID == discordID) {
			filtered = append(filtered, t)
		}
	}
	return writeJSON(tasksPath(dir), filtered)
}

// ─── Transactions CRUD ────────────────────────────────────────────────────────

func getTransactions(dir, discordID string) ([]Transaction, error) {
	txMu.RLock()
	all, err := readJSON[Transaction](transactionsPath(dir))
	txMu.RUnlock()
	if err != nil {
		return nil, err
	}
	out := []Transaction{}
	for _, tx := range all {
		if tx.UserDiscordID == discordID {
			out = append(out, tx)
		}
	}
	return out, nil
}

func createTransaction(dir, discordID string, in TransactionInput) (Transaction, error) {
	txMu.Lock()
	defer txMu.Unlock()

	all, _ := readJSON[Transaction](transactionsPath(dir))
	date := in.Date
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}
	currency := in.Currency
	if currency == "" {
		currency = "BRL"
	}
	tx := Transaction{
		ID:            uuid.New().String(),
		UserDiscordID: discordID,
		Type:          in.Type,
		Amount:        in.Amount,
		Currency:      currency,
		Category:      in.Category,
		Description:   in.Description,
		Recurring:     in.Recurring,
		Date:          date,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	all = append(all, tx)
	return tx, writeJSON(transactionsPath(dir), all)
}

func updateTransaction(dir, discordID, id string, in TransactionInput) error {
	txMu.Lock()
	defer txMu.Unlock()

	all, _ := readJSON[Transaction](transactionsPath(dir))
	for i, tx := range all {
		if tx.ID == id && tx.UserDiscordID == discordID {
			all[i].Type = in.Type
			all[i].Amount = in.Amount
			all[i].Currency = in.Currency
			all[i].Category = in.Category
			all[i].Description = in.Description
			all[i].Recurring = in.Recurring
			if in.Date != "" {
				all[i].Date = in.Date
			}
			return writeJSON(transactionsPath(dir), all)
		}
	}
	return nil
}

func deleteTransaction(dir, discordID, id string) error {
	txMu.Lock()
	defer txMu.Unlock()

	all, _ := readJSON[Transaction](transactionsPath(dir))
	filtered := all[:0]
	for _, tx := range all {
		if !(tx.ID == id && tx.UserDiscordID == discordID) {
			filtered = append(filtered, tx)
		}
	}
	return writeJSON(transactionsPath(dir), filtered)
}

func getFinanceSummary(dir, discordID string) (FinanceSummary, error) {
	txs, err := getTransactions(dir, discordID)
	if err != nil {
		return FinanceSummary{}, err
	}
	var income, expenses float64
	for _, tx := range txs {
		switch tx.Type {
		case "income":
			income += tx.Amount
		case "expense":
			expenses += tx.Amount
		}
	}
	return FinanceSummary{
		Income:   income,
		Expenses: expenses,
		Balance:  income - expenses,
		Period:   "all",
	}, nil
}

func getCategories(dir, discordID string) ([]string, error) {
	txs, err := getTransactions(dir, discordID)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	cats := []string{}
	for _, tx := range txs {
		if tx.Category != "" && !seen[tx.Category] {
			seen[tx.Category] = true
			cats = append(cats, tx.Category)
		}
	}
	return cats, nil
}
