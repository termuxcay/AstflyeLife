import { create } from 'zustand'
import { Message } from '@/hooks/useSocial'

interface ChatState {
  messages: Record<string, Message[]> // teamID -> messages
  socket: WebSocket | null
  activeTeam: string | null
  connect: (teamID: string, token: string, serverUrl: string) => void
  disconnect: () => void
  send: (teamID: string, content: string) => void
  addMessage: (teamID: string, msg: Message) => void
  setActiveTeam: (id: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  socket: null,
  activeTeam: null,

  setActiveTeam: (id) => set({ activeTeam: id }),

  addMessage: (teamID, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [teamID]: [...(s.messages[teamID] ?? []), msg],
      },
    })),

  connect: (teamID, token, serverUrl) => {
    get().disconnect()
    const wsUrl = serverUrl.replace(/^http/, 'ws') + `/ws?team_id=${teamID}&token=${token}`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        if (event.type === 'chat') {
          get().addMessage(teamID, event.payload as Message)
        }
      } catch {}
    }

    ws.onclose = () => set({ socket: null })
    set({ socket: ws, activeTeam: teamID })
  },

  disconnect: () => {
    get().socket?.close()
    set({ socket: null })
  },

  send: (teamID, content) => {
    const ws = get().socket
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', team_id: teamID, content }))
    }
  },
}))
