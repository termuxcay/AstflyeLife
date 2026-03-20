// Wails bridge wrapper — no HTTP fetch.
// All calls go through window.go.main.App.* (Wails IPC).

import {
  GetTasks, CreateTask, UpdateTask, UpdateTaskStatus, DeleteTask,
  GetTransactions, CreateTransaction, UpdateTransaction, DeleteTransaction,
  GetFinanceSummary, GetCategories,
} from '../../wailsjs/go/main/App'
import type { main } from '../../wailsjs/go/models'

export type { main }

export const api = {
  // Tasks
  getTasks: () => GetTasks(),
  createTask: (input: main.TaskInput) => CreateTask(input),
  updateTask: (id: string, input: main.TaskInput) => UpdateTask(id, input),
  updateTaskStatus: (id: string, status: string) => UpdateTaskStatus(id, status),
  deleteTask: (id: string) => DeleteTask(id),

  // Finance
  getTransactions: () => GetTransactions(),
  createTransaction: (input: main.TransactionInput) => CreateTransaction(input),
  updateTransaction: (id: string, input: main.TransactionInput) => UpdateTransaction(id, input),
  deleteTransaction: (id: string) => DeleteTransaction(id),
  getFinanceSummary: (period = 'all') => GetFinanceSummary(period),
  getCategories: () => GetCategories(),
}
