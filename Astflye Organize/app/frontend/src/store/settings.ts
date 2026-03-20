import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  soundEnabled: boolean
  notifyBefore: number // minutes
  setSoundEnabled: (v: boolean) => void
  setNotifyBefore: (v: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      notifyBefore: 5,
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setNotifyBefore: (v) => set({ notifyBefore: v }),
    }),
    { name: 'astflye-settings' },
  ),
)
