import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { main } from '../../wailsjs/go/models'

export type Transaction = main.Transaction
export type TransactionInput = main.TransactionInput
export type Summary = main.FinanceSummary

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => api.getTransactions(),
  })
}

export function useSummary(period = 'all') {
  return useQuery<Summary>({
    queryKey: ['summary', period],
    queryFn: () => api.getFinanceSummary(period),
  })
}

export function useCategories() {
  return useQuery<string[]>({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TransactionInput) => api.createTransaction(input),
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
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })
}
