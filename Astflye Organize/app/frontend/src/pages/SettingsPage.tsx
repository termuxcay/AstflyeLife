import { useMe } from '@/hooks/useMe'
import { useAuthStore } from '@/store/auth'
import { apiFetch } from '@/lib/api'

const card: React.CSSProperties = { background: '#110820', border: '1px solid #b455ff22', borderRadius: 12, padding: 16 }

export default function SettingsPage() {
  const { data: me } = useMe()
  const clear = useAuthStore((s) => s.clear)

  const handleLogout = async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }) } catch {}
    clear()
    window.location.href = '/login'
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: '#b455ff' }}>Settings</h1>

      {/* Profile */}
      <div style={card} className="flex items-center gap-4">
        {me?.avatar_url && (
          <img src={me.avatar_url} alt="avatar"
            className="rounded-full" style={{ width: 56, height: 56, border: '2px solid #b455ff44' }} />
        )}
        <div>
          <p className="font-semibold" style={{ color: '#e0d0ff' }}>{me?.username ?? '...'}</p>
          <p className="text-xs mt-0.5" style={{ color: '#554466' }}>Discord ID: {me?.discord_id ?? '...'}</p>
          <p className="text-xs" style={{ color: '#554466' }}>
            Streak: <span style={{ color: '#b455ff' }}>{me?.current_streak ?? 0} days</span>
            {' · '}Best: <span style={{ color: '#ff55aa' }}>{me?.longest_streak ?? 0} days</span>
          </p>
        </div>
      </div>

      {/* App info */}
      <div style={card} className="space-y-2">
        <p className="text-xs font-semibold tracking-widest" style={{ color: '#554466' }}>APP</p>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#776688' }}>Version</span>
          <span style={{ color: '#e0d0ff' }}>0.1.0</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: '#776688' }}>Server</span>
          <span style={{ color: '#e0d0ff' }}>{import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080'}</span>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ ...card, borderColor: '#ff446622' }}>
        <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#ff4466' }}>DANGER ZONE</p>
        <button onClick={handleLogout}
          className="w-full py-2 rounded-lg text-sm font-semibold cursor-pointer"
          style={{ background: '#ff446622', border: '1px solid #ff446644', color: '#ff6688' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
