import { useState, useEffect, useRef } from 'react'
import { useTeams, useCreateTeam, useTeamMessages } from '@/hooks/useSocial'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080'

const card: React.CSSProperties = { background: '#110820', border: '1px solid #b455ff22', borderRadius: 12 }
const inputStyle: React.CSSProperties = {
  background: '#1a0d2e', border: '1px solid #b455ff33',
  borderRadius: 8, padding: '8px 12px', color: '#e0d0ff', outline: 'none',
}

export default function SocialPage() {
  const { data: teams } = useTeams()
  const createTeam = useCreateTeam()
  const { activeTeam, messages, connect, disconnect, send, setActiveTeam } = useChatStore()
  const accessToken = useAuthStore((s) => s.accessToken)

  const [newTeamName, setNewTeamName] = useState('')
  const [chatInput, setChatInput] = useState('')
  const { data: history } = useTeamMessages(activeTeam ?? '')
  const bottomRef = useRef<HTMLDivElement>(null)

  // seed history into store when switching teams
  useEffect(() => {
    if (!activeTeam || !history) return
    useChatStore.setState((s) => ({
      messages: { ...s.messages, [activeTeam]: history },
    }))
  }, [activeTeam, history])

  // scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages[activeTeam ?? '']])

  const handleSelectTeam = (id: string) => {
    setActiveTeam(id)
    if (accessToken) connect(id, accessToken, SERVER_URL)
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim()) return
    await createTeam.mutateAsync({ name: newTeamName.trim() })
    setNewTeamName('')
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !activeTeam) return
    send(activeTeam, chatInput.trim())
    setChatInput('')
  }

  const teamMessages = activeTeam ? (messages[activeTeam] ?? []) : []

  return (
    <div className="max-w-4xl mx-auto flex gap-4 h-[calc(100vh-120px)]">
      {/* Sidebar */}
      <div className="w-56 flex flex-col gap-3 flex-shrink-0">
        <h1 className="text-xl font-bold" style={{ color: '#b455ff' }}>Social</h1>

        {/* Create team */}
        <form onSubmit={handleCreateTeam} className="flex gap-2">
          <input
            style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '6px 10px' }}
            placeholder="New team..."
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
          />
          <button type="submit"
            className="px-3 py-1 rounded-lg text-xs font-semibold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}>
            +
          </button>
        </form>

        {/* Team list */}
        <div className="flex flex-col gap-1 overflow-y-auto">
          {teams?.map(t => (
            <button key={t.id} onClick={() => handleSelectTeam(t.id)}
              className="text-left px-3 py-2 rounded-lg text-sm cursor-pointer truncate"
              style={{
                background: activeTeam === t.id ? '#b455ff22' : '#110820',
                border: `1px solid ${activeTeam === t.id ? '#b455ff' : '#b455ff22'}`,
                color: activeTeam === t.id ? '#e0d0ff' : '#776688',
              }}>
              # {t.name}
            </button>
          ))}
          {teams?.length === 0 && (
            <p className="text-xs" style={{ color: '#554466' }}>No teams yet.</p>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col" style={card}>
        {activeTeam ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #b455ff22' }}>
              <span className="text-sm font-semibold" style={{ color: '#e0d0ff' }}>
                # {teams?.find(t => t.id === activeTeam)?.name}
              </span>
              <button onClick={disconnect}
                className="text-xs cursor-pointer"
                style={{ color: '#554466' }}>
                leave
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {teamMessages.map((m, i) => (
                <div key={m.id ?? i} className="flex flex-col">
                  <span className="text-xs" style={{ color: '#554466' }}>
                    {m.sender_id.slice(0, 8)}
                    <span className="ml-2" style={{ color: '#332244' }}>
                      {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <span className="text-sm" style={{ color: '#e0d0ff' }}>{m.content}</span>
                </div>
              ))}
              {teamMessages.length === 0 && (
                <p className="text-xs text-center mt-10" style={{ color: '#332244' }}>
                  No messages yet. Say hi!
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="px-4 py-3 flex gap-2"
              style={{ borderTop: '1px solid #b455ff22' }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Type a message..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ color: '#332244' }}>Select or create a team to chat.</p>
          </div>
        )}
      </div>
    </div>
  )
}
