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
