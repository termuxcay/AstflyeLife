package main

import (
	"os"
	"testing"
)

const testDiscordID = "111222333444555666"

func TestTasks_CRUD(t *testing.T) {
	dir := t.TempDir()

	tasks, err := getTasks(dir, testDiscordID)
	if err != nil {
		t.Fatalf("getTasks error: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks, got %d", len(tasks))
	}

	task, err := createTask(dir, testDiscordID, TaskInput{Title: "Test task", Priority: "medium", Recurrence: "none"})
	if err != nil {
		t.Fatalf("createTask error: %v", err)
	}
	if task.ID == "" {
		t.Error("created task has no ID")
	}
	if task.Status != "pending" {
		t.Errorf("status = %q, want pending", task.Status)
	}

	tasks, _ = getTasks(dir, testDiscordID)
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}

	if err := updateTaskStatus(dir, testDiscordID, task.ID, "completed"); err != nil {
		t.Fatalf("updateTaskStatus error: %v", err)
	}
	tasks, _ = getTasks(dir, testDiscordID)
	if tasks[0].Status != "completed" {
		t.Errorf("status = %q, want completed", tasks[0].Status)
	}

	if err := updateTask(dir, testDiscordID, task.ID, TaskInput{Title: "Updated", Priority: "high", Recurrence: "none"}); err != nil {
		t.Fatalf("updateTask error: %v", err)
	}
	tasks, _ = getTasks(dir, testDiscordID)
	if tasks[0].Title != "Updated" {
		t.Errorf("title = %q, want Updated", tasks[0].Title)
	}

	if err := deleteTask(dir, testDiscordID, task.ID); err != nil {
		t.Fatalf("deleteTask error: %v", err)
	}
	tasks, _ = getTasks(dir, testDiscordID)
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks after delete, got %d", len(tasks))
	}
}

func TestTasks_IsolatedByUser(t *testing.T) {
	dir := t.TempDir()
	createTask(dir, "user_a", TaskInput{Title: "Task A", Recurrence: "none"})
	createTask(dir, "user_b", TaskInput{Title: "Task B", Recurrence: "none"})

	tasksA, _ := getTasks(dir, "user_a")
	tasksB, _ := getTasks(dir, "user_b")
	if len(tasksA) != 1 || tasksA[0].Title != "Task A" {
		t.Error("user_a should see only their task")
	}
	if len(tasksB) != 1 || tasksB[0].Title != "Task B" {
		t.Error("user_b should see only their task")
	}
}

func TestTasks_CorruptFile(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(dir+"/tasks.json", []byte("not valid json{{"), 0644)
	tasks, err := getTasks(dir, testDiscordID)
	if err != nil {
		t.Fatalf("corrupt file should not error, got: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks from corrupt file, got %d", len(tasks))
	}
}

func TestTransactions_CRUD(t *testing.T) {
	dir := t.TempDir()

	txs, _ := getTransactions(dir, testDiscordID)
	if len(txs) != 0 {
		t.Errorf("expected 0 transactions, got %d", len(txs))
	}

	tx, err := createTransaction(dir, testDiscordID, TransactionInput{
		Type: "expense", Amount: 50.0, Currency: "BRL", Category: "food", Date: "2026-03-20",
	})
	if err != nil {
		t.Fatalf("createTransaction error: %v", err)
	}
	if tx.ID == "" {
		t.Error("transaction has no ID")
	}

	txs, _ = getTransactions(dir, testDiscordID)
	if len(txs) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(txs))
	}

	if err := deleteTransaction(dir, testDiscordID, tx.ID); err != nil {
		t.Fatalf("deleteTransaction error: %v", err)
	}
	txs, _ = getTransactions(dir, testDiscordID)
	if len(txs) != 0 {
		t.Errorf("expected 0 after delete, got %d", len(txs))
	}
}

func TestFinanceSummary(t *testing.T) {
	dir := t.TempDir()
	createTransaction(dir, testDiscordID, TransactionInput{Type: "income", Amount: 1000.0, Currency: "BRL", Category: "salary", Date: "2026-03-01"})
	createTransaction(dir, testDiscordID, TransactionInput{Type: "expense", Amount: 200.0, Currency: "BRL", Category: "food", Date: "2026-03-15"})

	sum, err := getFinanceSummary(dir, testDiscordID)
	if err != nil {
		t.Fatalf("getFinanceSummary error: %v", err)
	}
	if sum.Income != 1000.0 {
		t.Errorf("income = %f, want 1000.0", sum.Income)
	}
	if sum.Expenses != 200.0 {
		t.Errorf("expenses = %f, want 200.0", sum.Expenses)
	}
	if sum.Balance != 800.0 {
		t.Errorf("balance = %f, want 800.0", sum.Balance)
	}
}

func TestGetCategories(t *testing.T) {
	dir := t.TempDir()
	createTransaction(dir, testDiscordID, TransactionInput{Type: "expense", Amount: 10, Currency: "BRL", Category: "food", Date: "2026-03-01"})
	createTransaction(dir, testDiscordID, TransactionInput{Type: "expense", Amount: 20, Currency: "BRL", Category: "food", Date: "2026-03-02"})
	createTransaction(dir, testDiscordID, TransactionInput{Type: "income", Amount: 100, Currency: "BRL", Category: "salary", Date: "2026-03-03"})

	cats, err := getCategories(dir, testDiscordID)
	if err != nil {
		t.Fatalf("getCategories error: %v", err)
	}
	if len(cats) != 2 {
		t.Errorf("expected 2 categories, got %d: %v", len(cats), cats)
	}
}
