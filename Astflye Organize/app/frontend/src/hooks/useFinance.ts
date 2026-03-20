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
  const params = filters ? new URLSearchParams(filters).toString() : ''
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
