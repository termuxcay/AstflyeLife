import { useAuthStore } from '@/store/auth'

export interface User {
  discord_id: string
  username: string
  global_name: string
  avatar: string
  member_since: string
}

export function useMe(): User | null {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return {
    discord_id: user.discordId,
    username: user.username,
    global_name: user.globalName,
    avatar: user.avatar,
    member_since: user.memberSince,
  }
}
