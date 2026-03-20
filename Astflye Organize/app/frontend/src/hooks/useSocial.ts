import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface Team {
  id: string
  name: string
  description: string
  owner_id: string
  created_at: string
}

export interface Message {
  id: string
  team_id: string
  sender_id: string
  content: string
  created_at: string
}

export interface Friendship {
  id: string
  user_id: string
  friend_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

export function useTeams() {
  return useQuery<Team[]>({ queryKey: ['teams'], queryFn: () => apiFetch('/teams') })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiFetch('/teams', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  })
}

export function useTeamMessages(teamID: string) {
  return useQuery<Message[]>({
    queryKey: ['messages', teamID],
    queryFn: () => apiFetch(`/teams/${teamID}/messages`),
    enabled: !!teamID,
  })
}

export function useFriends() {
  return useQuery<Friendship[]>({ queryKey: ['friends'], queryFn: () => apiFetch('/friends') })
}

export function useSendFriendRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (toUserID: string) =>
      apiFetch('/friends', { method: 'POST', body: JSON.stringify({ to_user_id: toUserID }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  })
}
