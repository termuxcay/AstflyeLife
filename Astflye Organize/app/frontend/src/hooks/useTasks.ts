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
  const params = filters ? new URLSearchParams(filters).toString() : ''
  return useQuery<Task[]>({
    queryKey: ['tasks', filters],
    queryFn: () => apiFetch(`/tasks${params ? '?' + params : ''}`),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Task>) =>
      apiFetch('/tasks', { method: 'POST', body: JSON.stringify(data) }),
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
      qc.invalidateQueries({ queryKey: ['me'] })
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
