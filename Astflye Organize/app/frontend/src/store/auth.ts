import { create } from 'zustand'

export interface StoredUser {
  username: string
  globalName: string
  avatar: string
  discordId: string
}

interface AuthState {
  accessToken: string | null
  user: StoredUser | null
  setTokens: (access: string, user: StoredUser) => void
  clear: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  setTokens: (access, user) => set({ accessToken: access, user }),
  clear: () => set({ accessToken: null, user: null }),
  isAuthenticated: () => !!get().accessToken,
}))
