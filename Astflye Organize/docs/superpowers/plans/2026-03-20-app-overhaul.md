# Astflye App Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete overhaul covering animations, tasks kanban+due-dates+notifications, finance period-filter+recurring, modern chart, dashboard redesign, profile settings, sound system, and window maximize.

**Architecture:** All data flows through Wails bridge (Go ↔ React). Sounds use Web Audio API synthesis (no files). Notifications use Go goroutine polling + Wails events. Drag-and-drop uses HTML5 native drag API (no extra deps).

**Tech Stack:** Go/Wails v2, React 18, TanStack Query, Zustand, Recharts, Web Audio API

---

## Files Modified/Created

### Go
- Modify: `app/data.go` — add `DueTime`, `NotifyBefore` to Task; `RecurringPeriod` to Transaction; fix `getFinanceSummary` period filter
- Modify: `app/app.go` — add `GetTasksDue()`, notification goroutine, `memberSince` already there
- Modify: `app/main.go` — maximize on startup, MinWidth/MinHeight

### Frontend Bridge
- Modify: `app/frontend/wailsjs/go/models.ts` — new fields
- Modify: `app/frontend/wailsjs/go/main/App.d.ts` — `GetTasksDue`
- Modify: `app/frontend/wailsjs/go/main/App.js` — `GetTasksDue`

### Frontend Source
- Create: `app/frontend/src/lib/sounds.ts` — Web Audio API synth sounds
- Create: `app/frontend/src/store/settings.ts` — sound/notification prefs (Zustand + localStorage)
- Create: `app/frontend/src/components/tasks/KanbanBoard.tsx` — drag-and-drop kanban
- Create: `app/frontend/src/components/ui/Toast.tsx` — in-app notification toast
- Modify: `app/frontend/src/index.css` — scale, new animations, titlebar drag
- Modify: `app/frontend/src/components/layout/DashboardLayout.tsx` — custom titlebar
- Modify: `app/frontend/src/components/layout/Sidebar.tsx` — bigger, better
- Modify: `app/frontend/src/components/tasks/TaskCard.tsx` — due date, drag handle, sounds
- Modify: `app/frontend/src/components/finance/SummaryChart.tsx` — AreaChart with gradients
- Modify: `app/frontend/src/components/finance/TransactionRow.tsx` — recurring badge
- Modify: `app/frontend/src/pages/TasksPage.tsx` — kanban + list toggle
- Modify: `app/frontend/src/pages/NewTaskPage.tsx` — due date/time, notify-before
- Modify: `app/frontend/src/pages/FinancePage.tsx` — period filter working, recurring section
- Modify: `app/frontend/src/pages/NewTransactionPage.tsx` — recurring period
- Modify: `app/frontend/src/pages/DashboardPage.tsx` — full redesign
- Modify: `app/frontend/src/pages/ProfilePage.tsx` — sound/notification settings
- Modify: `app/frontend/src/main.tsx` — notification event listener

---

### Task 1: Go Backend + Window

**Files:**
- Modify: `app/data.go`
- Modify: `app/app.go`
- Modify: `app/main.go`

- [ ] Add `DueTime string` and `NotifyBefore int` to `Task` and `TaskInput` structs in `data.go`
- [ ] Add `RecurringPeriod string` to `Transaction` and `TransactionInput` in `data.go`
- [ ] Fix `getFinanceSummary` to actually filter transactions by period (daily=today, weekly=last 7 days, monthly=current month, yearly=current year)
- [ ] Update `createTask` and `updateTask` to store new fields
- [ ] Update `createTransaction` to store `RecurringPeriod`
- [ ] Add `GetTasksDue(minutes int) ([]Task, error)` to `app.go` — returns tasks where due_date+due_time is within `minutes` minutes
- [ ] Start notification polling goroutine in `app.startup` (checks every 60s, emits `task:due-soon` with task data)
- [ ] Add `runtime.WindowMaximise(ctx)` call in `app.startup`
- [ ] Add `MinWidth: 1024, MinHeight: 700` to wails options in `main.go`
- [ ] Run `go build ./...` and `go test ./...` — both must pass
- [ ] Commit

### Task 2: Sound System + Settings Store

**Files:**
- Create: `app/frontend/src/lib/sounds.ts`
- Create: `app/frontend/src/store/settings.ts`

- [ ] Create `sounds.ts` with Web Audio API synthesis: `playLogin()`, `playTaskDone()`, `playTaskCreate()`, `playTaskDelete()`, `playExpenseAdd()`, `playNotification()`
- [ ] Each sound is a short (< 0.3s) satisfying tone/chime using OscillatorNode
- [ ] Create `settings.ts` Zustand store persisted to localStorage: `soundEnabled: boolean`, `notifyBefore: number` (minutes, default 5), `setSoundEnabled`, `setNotifyBefore`
- [ ] Export `playSound(name)` that checks `soundEnabled` before playing

### Task 3: Bridge + CSS

**Files:**
- Modify: `app/frontend/wailsjs/go/models.ts`
- Modify: `app/frontend/wailsjs/go/main/App.d.ts`
- Modify: `app/frontend/wailsjs/go/main/App.js`
- Modify: `app/frontend/src/index.css`

- [ ] Add `due_time`, `notify_before` to `Task` and `TaskInput` interfaces in `models.ts`
- [ ] Add `recurring_period` to `Transaction` and `TransactionInput` interfaces in `models.ts`
- [ ] Add `GetTasksDue(arg1: number): Promise<Array<main.Task>>` to `App.d.ts` and `App.js`
- [ ] In `index.css`: increase base `font-size` to 16px, `body` padding adjustments
- [ ] Add `@keyframes slideInRight`, `@keyframes slideOutRight`, `@keyframes scaleIn` keyframes
- [ ] Add `--wails-draggable: drag` CSS class `.titlebar-drag`
- [ ] Add `.toast` animation classes
- [ ] Add `.kanban-col` styles, `.drag-over` highlight style
- [ ] Increase `.stat-card` padding to 24px 20px
- [ ] Increase `.input-neon` padding to 12px 16px

### Task 4: Tasks Overhaul

**Files:**
- Create: `app/frontend/src/components/tasks/KanbanBoard.tsx`
- Create: `app/frontend/src/components/ui/Toast.tsx`
- Modify: `app/frontend/src/components/tasks/TaskCard.tsx`
- Modify: `app/frontend/src/pages/TasksPage.tsx`
- Modify: `app/frontend/src/pages/NewTaskPage.tsx`
- Modify: `app/frontend/src/main.tsx`

- [ ] Create `KanbanBoard.tsx`: 4 columns (Pending, Em Progresso, Concluído, Pulado), HTML5 drag-and-drop, cards draggable between columns, `onStatusChange` on drop
- [ ] Create `Toast.tsx`: in-app notification component that auto-dismisses after 5s, used for due-soon alerts
- [ ] Update `TaskCard.tsx`: add drag handle icon, show `due_date`+`due_time` badge if set, call `playSound('taskDone')` on complete, call `playSound('taskDelete')` on delete
- [ ] Update `TasksPage.tsx`: add list/kanban toggle button, pass `updateStatus` to `KanbanBoard`, animate page entrance
- [ ] Update `NewTaskPage.tsx`: add `due_date` input (type=date), `due_time` input (type=time), `notify_before` number input (default 5 min), call `playSound('taskCreate')` on success
- [ ] Update `main.tsx`: add `useEffect` that listens to `runtime.EventsOn('task:due-soon', ...)` and shows Toast

### Task 5: Finance Overhaul

**Files:**
- Modify: `app/frontend/src/components/finance/SummaryChart.tsx`
- Modify: `app/frontend/src/components/finance/TransactionRow.tsx`
- Modify: `app/frontend/src/pages/FinancePage.tsx`
- Modify: `app/frontend/src/pages/NewTransactionPage.tsx`

- [ ] Rewrite `SummaryChart.tsx` to use `AreaChart` with `defs` gradients, animate on mount, proper monthly labels
- [ ] Update `TransactionRow.tsx`: show recurring badge if `recurring=true`, show `recurring_period`, add animation delay
- [ ] Update `FinancePage.tsx`: pass period to `useTransactions` filter client-side, show recurring section separately, better layout, add entrance animations
- [ ] Update `NewTransactionPage.tsx`: add `recurring_period` select (none/daily/weekly/monthly/yearly), call `playSound('expenseAdd')` on success

### Task 6: Dashboard Overhaul

**Files:**
- Modify: `app/frontend/src/pages/DashboardPage.tsx`

- [ ] Add "Upcoming Tasks" section showing tasks with due_date sorted by date
- [ ] Add "Quick Actions" row (Add Task, Add Expense buttons)
- [ ] Add recent transactions mini-list (last 3)
- [ ] Fix streak card to use real data if available, keep 0 as fallback
- [ ] Add animated greeting with time-of-day message (Bom dia/Boa tarde/Boa noite)
- [ ] Better layout with 2-column grid for stats + activity

### Task 7: Profile/Settings + Layout Overhaul

**Files:**
- Modify: `app/frontend/src/pages/ProfilePage.tsx`
- Modify: `app/frontend/src/components/layout/DashboardLayout.tsx`
- Modify: `app/frontend/src/components/layout/Sidebar.tsx`

- [ ] Add Wails custom titlebar in `DashboardLayout.tsx` with app name, minimize/maximize/close buttons calling `runtime.WindowMinimise/Maximise/Hide`
- [ ] Add `--wails-draggable: drag` to titlebar area
- [ ] Increase sidebar padding, nav item height
- [ ] Update `ProfilePage.tsx`: add "Sound" section with toggle (uses `useSettingsStore`), add "Notificações" section with `notifyBefore` number input
- [ ] Persist settings to localStorage via Zustand `persist`

### Task 8: Build, Test, Commit

- [ ] Run `npm run build` from `app/frontend/` — must pass with 0 errors
- [ ] Run `go build ./...` from `app/` — must pass
- [ ] Run `go test ./...` from `app/` — all tests pass
- [ ] `git add` all changed files
- [ ] Commit with message describing all changes
- [ ] `git push`
