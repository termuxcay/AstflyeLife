import { useNavigate } from 'react-router-dom'
import { useMe } from '@/hooks/useMe'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'

// ── reusable section card ────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(16,9,28,0.85)',
      border: '1px solid rgba(180,85,255,0.12)',
      borderRadius: 16,
      padding: '24px',
      backdropFilter: 'blur(12px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(180,85,255,0.4),transparent)',
      }} />
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em',
        color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 20,
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

// ── toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({
  label, description, value, onChange,
}: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0',
      borderBottom: '1px solid rgba(180,85,255,0.05)',
    }}>
      <div>
        <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 46, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer',
          background: value
            ? 'linear-gradient(90deg,#b455ff,#ff55aa)'
            : 'rgba(255,255,255,0.08)',
          position: 'relative', transition: 'all 0.25s ease',
          boxShadow: value ? '0 0 12px rgba(180,85,255,0.4)' : 'none',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3,
          left: value ? 22 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.25s ease',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }} />
      </button>
    </div>
  )
}

export default function ProfilePage() {
  const me = useMe()
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()
  const { soundEnabled, notifyBefore, setSoundEnabled, setNotifyBefore } = useSettingsStore()

  const handleLogout = async () => {
    await window.go?.main.App.Logout()
    clear()
    navigate('/login')
  }

  const displayName = me?.global_name || me?.username || '...'
  const handle      = me?.username ? `@${me.username}` : '...'
  const memberSince = me?.member_since
    ? new Date(me.member_since).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* ── page header ─────────────────────────────────────────────────── */}
      <div className="anim-fade-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)',
            boxShadow: '0 0 12px var(--primary)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            profile
          </span>
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800,
          color: 'var(--text)', letterSpacing: '-0.02em',
        }}>
          Meu <span style={{ color: 'var(--primary)', textShadow: '0 0 24px rgba(180,85,255,0.5)' }}>Perfil</span>
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── hero profile card ─────────────────────────────────────────── */}
        <div className="anim-fade-up delay-1" style={{
          background: 'rgba(16,9,28,0.9)',
          border: '1px solid rgba(180,85,255,0.15)',
          borderRadius: 20,
          padding: '32px 28px',
          backdropFilter: 'blur(16px)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* top glow line */}
          <div style={{
            position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
            background: 'linear-gradient(90deg,transparent,rgba(180,85,255,0.6),rgba(255,85,170,0.4),transparent)',
          }} />
          {/* bg mesh */}
          <div style={{
            position: 'absolute', top: -60, right: -60, width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(180,85,255,0.06) 0%,transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, position: 'relative', zIndex: 1 }}>
            {/* avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {me?.avatar ? (
                <img
                  src={me.avatar}
                  alt={displayName}
                  style={{
                    width: 88, height: 88, borderRadius: '50%',
                    border: '2px solid rgba(180,85,255,0.4)',
                    boxShadow: '0 0 24px rgba(180,85,255,0.25), 0 0 60px rgba(180,85,255,0.08)',
                  }}
                />
              ) : (
                <div style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: 'linear-gradient(135deg,rgba(180,85,255,0.2),rgba(255,85,170,0.1))',
                  border: '2px solid rgba(180,85,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34,
                  color: 'var(--primary)',
                }}>
                  {displayName[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              {/* online dot */}
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 14, height: 14, borderRadius: '50%',
                background: 'var(--green)',
                border: '2px solid #08050f',
                boxShadow: '0 0 8px var(--green)',
                animation: 'pulse-glow 2s ease-in-out infinite',
              }} />
            </div>

            {/* identity */}
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800,
                color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 4,
              }}>
                {displayName}
              </h2>
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                color: 'var(--primary)', marginBottom: 6,
                textShadow: '0 0 12px rgba(180,85,255,0.4)',
              }}>
                {handle}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Membro desde {memberSince}
                </span>
                {me?.discord_id && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
                    </svg>
                    {me.discord_id}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── som ──────────────────────────────────────────────────────── */}
        <div className="anim-fade-up delay-2">
          <Card title="Som">
            <ToggleRow
              label="Sons do App"
              description="Feedback sonoro ao criar tarefas, completar, adicionar despesas, etc."
              value={soundEnabled}
              onChange={setSoundEnabled}
            />
          </Card>
        </div>

        {/* ── notificações ─────────────────────────────────────────────── */}
        <div className="anim-fade-up delay-3">
          <Card title="Notificações">
            <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(180,85,255,0.05)' }}>
              <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Avisar antes do prazo</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Receba alertas X minutos antes da tarefa vencer</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number" min={1} max={1440}
                  value={notifyBefore}
                  onChange={e => setNotifyBefore(Number(e.target.value))}
                  className="input-neon"
                  style={{ width: 100, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16 }}
                />
                <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>minutos</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── app info ─────────────────────────────────────────────────── */}
        <div className="anim-fade-up delay-4">
          <Card title="Sobre o App">
            {[
              { k: 'Versão',   v: '1.0.0' },
              { k: 'Build',    v: 'Wails v2 + Go + React' },
              { k: 'Armazenamento', v: '%AppData%\\Astflye' },
            ].map(row => (
              <div key={row.k} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid rgba(180,85,255,0.05)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{row.k}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{row.v}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* ── danger zone ──────────────────────────────────────────────── */}
        <div className="anim-fade-up delay-5" style={{
          background: 'rgba(255,51,102,0.04)',
          border: '1px solid rgba(255,51,102,0.12)',
          borderRadius: 16, padding: '24px',
        }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em',
            color: 'rgba(255,51,102,0.7)', textTransform: 'uppercase', marginBottom: 16,
          }}>
            Zona de Perigo
          </p>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.2)',
              color: '#ff6688', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,51,102,0.16)'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255,51,102,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,51,102,0.08)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Sair da conta
          </button>
        </div>

      </div>
    </div>
  )
}
