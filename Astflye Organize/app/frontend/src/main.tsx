import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import LoginPage from '@/pages/LoginPage'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DashboardPage from '@/pages/DashboardPage'
import TasksPage from '@/pages/TasksPage'
import NewTaskPage from '@/pages/NewTaskPage'
import FinancePage from '@/pages/FinancePage'
import NewTransactionPage from '@/pages/NewTransactionPage'
import SocialPage from '@/pages/SocialPage'
import ProfilePage from '@/pages/ProfilePage'
import { ToastContainer, type ToastMessage } from '@/components/ui/Toast'
import { playSound } from '@/lib/sounds'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if ((error as Error)?.message === 'Unauthorized') return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />
}

function AppWithNotifications({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const w = window as any
    if (!w.runtime?.EventsOn) return
    const off = w.runtime.EventsOn('task:due-soon', (task: any) => {
      playSound('notification')
      setToasts(prev => [...prev, {
        id: task.id + '-' + Date.now(),
        title: 'Tarefa vencendo em breve',
        body: task.title,
        type: 'warning' as const,
      }])
    })
    return () => { if (typeof off === 'function') off() }
  }, [])

  return (
    <>
      {children}
      <ToastContainer messages={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppWithNotifications>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Routes>
                    <Route index element={<DashboardPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="tasks/new" element={<NewTaskPage />} />
                    <Route path="finance" element={<FinancePage />} />
                    <Route path="finance/new" element={<NewTransactionPage />} />
                    <Route path="social" element={<SocialPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                  </Routes>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
        </AppWithNotifications>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
