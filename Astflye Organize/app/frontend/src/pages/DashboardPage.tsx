import { useMe } from '@/hooks/useMe'
import { useTasks } from '@/hooks/useTasks'
import { useSummary } from '@/hooks/useFinance'

function StatCard({ label, value, sub, color, delay, icon }: {
  label: string; value: string | number; sub: string
  color: string; delay: string; icon: React.ReactNode
}) {
  return (
    <div className="stat-card anim-fade-up" style={{ animationDelay: delay }}>
      {/* corner accent */}
      <div style={{
        position: 'absolute', top: 10, right: 10, color: 'rgba(180,85,255,0.2)',
        display: 'flex',
      }}>{icon}</div>
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em',
        color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8,
      }}>{label}</p>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800,
        color, lineHeight: 1, marginBottom: 6,
        textShadow: `0 0 20px ${color}66`,
      }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>{sub}</p>
    </div>
  )
}

export default function DashboardPage() {
  const me = useMe()
  const { data: allTasks } = useTasks()
  const todayTasks = allTasks?.filter(t => t.recurrence === 'daily')
  const { data: summary } = useSummary('monthly')

  const completed = todayTasks?.filter(t => t.status === 'completed').length ?? 0
  const total = todayTasks?.length ?? 0
  const progress = total > 0 ? (completed / total) * 100 : 0
  const balance = summary?.balance ?? 0

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div className="anim-fade-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)',
            boxShadow: '0 0 12px var(--primary)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            dashboard
          </span>
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800,
          color: 'var(--text)', letterSpacing: '-0.02em',
        }}>
          Hey, <span style={{ color: 'var(--primary)', textShadow: '0 0 24px rgba(180,85,255,0.6)' }}>
            {me?.global_name || me?.username || '...'}
          </span> 👋
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>Aqui está o seu dia de hoje.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard
          label="Streak" delay="0.1s"
          value={0}
          sub="best: 0 days"
          color="var(--primary)"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>}
        />
        <StatCard
          label="Today" delay="0.2s"
          value={`${completed}/${total}`}
          sub="tasks done"
          color="var(--accent)"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <StatCard
          label="Balance" delay="0.3s"
          value={`R$${(balance / 1000).toFixed(1)}k`}
          sub="this month"
          color={balance >= 0 ? 'var(--green)' : 'var(--red)'}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        />
      </div>

      {/* Progress card */}
      <div className="glass anim-fade-up delay-4" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            Daily Progress
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--primary)', textShadow: '0 0 12px rgba(180,85,255,0.5)' }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        {progress === 100 && total > 0 && (
          <p style={{
            marginTop: 10, textAlign: 'center', fontSize: 12,
            fontFamily: 'var(--font-display)', fontWeight: 600,
            color: 'var(--primary)', textShadow: '0 0 10px rgba(180,85,255,0.5)',
          }}>
            🔥 All done! You crushed today.
          </p>
        )}
        {total === 0 && (
          <p style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: 'var(--muted2)' }}>
            No daily tasks yet — add some to track progress.
          </p>
        )}
      </div>

      {/* Quick tasks preview */}
      {(todayTasks?.length ?? 0) > 0 && (
        <div className="glass anim-fade-up delay-5" style={{ padding: '16px 20px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>
            Today's Tasks
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayTasks?.slice(0, 4).map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0', borderBottom: '1px solid rgba(180,85,255,0.06)',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: t.status === 'completed' ? 'var(--green)' : 'rgba(180,85,255,0.3)',
                  boxShadow: t.status === 'completed' ? '0 0 6px var(--green)' : 'none',
                }} />
                <span style={{
                  fontSize: 13, color: t.status === 'completed' ? 'var(--muted)' : 'var(--text)',
                  textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                  flex: 1,
                }}>{t.title}</span>
                {t.priority === 'urgent' && (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: 'rgba(255,51,102,0.2)', color: 'var(--red)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>!</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
