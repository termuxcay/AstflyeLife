import { Link } from 'react-router-dom'
import { useMe } from '@/hooks/useMe'
import { useTasks } from '@/hooks/useTasks'
import { useSummary, useTransactions } from '@/hooks/useFinance'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function StatCard({ label, value, sub, color, delay, icon }: {
  label: string; value: string | number; sub: string
  color: string; delay: string; icon: React.ReactNode
}) {
  return (
    <div className="stat-card anim-fade-up" style={{ animationDelay: delay }}>
      <div style={{ position: 'absolute', top: 12, right: 12, color: 'rgba(180,85,255,0.2)', display: 'flex' }}>{icon}</div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color, lineHeight: 1, marginBottom: 6, textShadow: `0 0 20px ${color}66` }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>{sub}</p>
    </div>
  )
}

export default function DashboardPage() {
  const me = useMe()
  const { data: allTasks } = useTasks()
  const { data: summary } = useSummary('monthly')
  const { data: transactions } = useTransactions()

  const pendingTasks = allTasks?.filter(t => t.status === 'pending' || t.status === 'in_progress') ?? []
  const completedToday = allTasks?.filter(t => t.status === 'completed' && t.completed_at?.startsWith(new Date().toISOString().slice(0, 10))).length ?? 0
  const totalTasks = allTasks?.length ?? 0
  const progress = totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0

  const upcomingTasks = [...pendingTasks]
    .filter(t => t.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)

  const recentTx = [...(transactions ?? [])].slice(-3).reverse()
  const balance = summary?.balance ?? 0

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header — animated greeting */}
      <div className="anim-fade-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)',
            boxShadow: '0 0 12px var(--primary)', animation: 'pulse-glow 2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {getGreeting()}
          </span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Olá,{' '}
          <span style={{ color: 'var(--primary)', textShadow: '0 0 24px rgba(180,85,255,0.6)' }}>
            {me?.global_name || me?.username || '...'}
          </span>
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>Aqui está o resumo do seu dia.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard
          label="Streak" delay="0.1s"
          value={0}
          sub="melhor: 0 dias"
          color="var(--primary)"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>}
        />
        <StatCard
          label="Pendentes" delay="0.2s"
          value={pendingTasks.length}
          sub={`de ${totalTasks} tarefas`}
          color="var(--accent)"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <StatCard
          label="Saldo" delay="0.3s"
          value={`R$${Math.abs(balance).toFixed(0)}`}
          sub="este mês"
          color={balance >= 0 ? 'var(--green)' : 'var(--red)'}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        />
      </div>

      {/* Quick actions */}
      <div className="anim-fade-up delay-3" style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <Link to="/tasks/new" style={{
          flex: 1, padding: '14px 18px', borderRadius: 10, textDecoration: 'none',
          background: 'rgba(180,85,255,0.08)', border: '1px solid rgba(180,85,255,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--primary)',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(180,85,255,0.13)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(180,85,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova Tarefa
        </Link>
        <Link to="/finance/new" style={{
          flex: 1, padding: '14px 18px', borderRadius: 10, textDecoration: 'none',
          background: 'rgba(255,85,170,0.08)', border: '1px solid rgba(255,85,170,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--accent)',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,85,170,0.13)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,85,170,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Despesa
        </Link>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Upcoming tasks */}
        <div className="glass anim-fade-up delay-3" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
              Próximas Tarefas
            </p>
            <Link to="/tasks" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>ver todas →</Link>
          </div>
          {upcomingTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingTasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(180,85,255,0.06)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: 'rgba(180,85,255,0.3)' }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', flexShrink: 0 }}>{t.due_date}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 24, marginBottom: 6 }}>📋</p>
              <p style={{ fontSize: 12, color: 'var(--muted2)' }}>Nenhuma tarefa com prazo.</p>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="glass anim-fade-up delay-4" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>
              Recentes
            </p>
            <Link to="/finance" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>ver todas →</Link>
          </div>
          {recentTx.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentTx.map(tx => {
                const isIncome = tx.type === 'income'
                return (
                  <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(180,85,255,0.06)' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: isIncome ? 'rgba(0,232,122,0.1)' : 'rgba(255,51,102,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isIncome ? '#00e87a' : '#ff3366'} strokeWidth="2.5">
                        {isIncome
                          ? <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
                          : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                        }
                      </svg>
                    </div>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description || tx.category}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: isIncome ? '#00e87a' : '#ff3366', flexShrink: 0 }}>
                      {isIncome ? '+' : '-'}R${tx.amount.toFixed(0)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 24, marginBottom: 6 }}>💰</p>
              <p style={{ fontSize: 12, color: 'var(--muted2)' }}>Sem transações ainda.</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress card */}
      <div className="glass anim-fade-up delay-5" style={{ padding: '20px 24px', marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
            Progresso Diário
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--primary)', textShadow: '0 0 12px rgba(180,85,255,0.5)' }}>
            {progress}%
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        {progress === 100 && totalTasks > 0 && (
          <p style={{ marginTop: 10, textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--primary)', textShadow: '0 0 10px rgba(180,85,255,0.5)' }}>
            Parabéns! Você concluiu tudo hoje.
          </p>
        )}
      </div>
    </div>
  )
}
