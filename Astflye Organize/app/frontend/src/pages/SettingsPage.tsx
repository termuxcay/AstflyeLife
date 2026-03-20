import { useMe } from '@/hooks/useMe'
import { useAuthStore } from '@/store/auth'
import { apiFetch } from '@/lib/api'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid rgba(180,85,255,0.1)',
    borderRadius: 12, padding: '20px', backdropFilter: 'blur(8px)',
    position: 'relative', overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
      background: 'linear-gradient(90deg, transparent, rgba(180,85,255,0.3), transparent)',
    }} />
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 16 }}>{title}</p>
    {children}
  </div>
)

export default function SettingsPage() {
  const { data: me } = useMe()
  const clear = useAuthStore((s) => s.clear)

  const handleLogout = async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }) } catch {}
    clear()
    window.location.href = '/login'
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="anim-fade-up" style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>settings</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Settings</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Profile */}
        <div className="anim-fade-up delay-1">
          <Section title="Profile">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {me?.avatar_url ? (
                <img src={me.avatar_url} alt="avatar" style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: '2px solid rgba(180,85,255,0.3)',
                  boxShadow: '0 0 16px rgba(180,85,255,0.15)',
                }} />
              ) : (
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(180,85,255,0.1)', border: '2px solid rgba(180,85,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--primary)',
                }}>
                  {me?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--text)', marginBottom: 3 }}>
                  {me?.username ?? '...'}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                  {me?.discord_id ?? '—'}
                </p>
              </div>
            </div>
          </Section>
        </div>

        {/* Stats */}
        <div className="anim-fade-up delay-2">
          <Section title="Streak Stats">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Current Streak', value: `${me?.current_streak ?? 0} days`, color: 'var(--primary)' },
                { label: 'Best Streak',    value: `${me?.longest_streak ?? 0} days`, color: 'var(--accent)' },
              ].map(s => (
                <div key={s.label} style={{
                  padding: '12px', borderRadius: 8,
                  background: 'rgba(13,8,24,0.6)', border: '1px solid rgba(180,85,255,0.08)',
                }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: s.color, textShadow: `0 0 12px ${s.color}55` }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* App info */}
        <div className="anim-fade-up delay-3">
          <Section title="App">
            {[
              { key: 'Version',  val: '0.1.0' },
              { key: 'Server',   val: import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080' },
              { key: 'Build',    val: 'Wails v2 + React + Go Fiber' },
            ].map(row => (
              <div key={row.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 0', borderBottom: '1px solid rgba(180,85,255,0.05)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{row.key}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>{row.val}</span>
              </div>
            ))}
          </Section>
        </div>

        {/* Danger */}
        <div className="anim-fade-up delay-4">
          <div style={{
            background: 'rgba(255,51,102,0.05)', border: '1px solid rgba(255,51,102,0.15)',
            borderRadius: 12, padding: '20px',
          }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: '#ff3366', textTransform: 'uppercase', marginBottom: 14 }}>Danger Zone</p>
            <button onClick={handleLogout} style={{
              width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.25)',
              color: '#ff6688', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,51,102,0.18)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,51,102,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,51,102,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              Sign Out
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
