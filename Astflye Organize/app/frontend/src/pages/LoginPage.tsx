import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

declare global {
  interface Window {
    go?: { main: { App: { StartLogin: (url: string) => Promise<void>; GetAccessToken: () => Promise<string> } } }
    runtime?: { EventsOn: (event: string, cb: () => void) => void }
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)

  useEffect(() => {
    window.runtime?.EventsOn('auth:success', async () => {
      const token = await window.go?.main.App.GetAccessToken()
      if (token) {
        setTokens(token, '')
        navigate('/')
      }
    })
  }, [setTokens, navigate])

  const handleLogin = async () => {
    await window.go?.main.App.StartLogin('http://localhost:3005')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#08050f' }}>
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold" style={{ color: '#b455ff' }}>Astflye Life</h1>
        <p className="text-sm" style={{ color: '#776688' }}>Your productivity universe</p>
        <button
          onClick={handleLogin}
          className="px-8 py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}
        >
          Login with Discord
        </button>
      </div>
    </div>
  )
}
