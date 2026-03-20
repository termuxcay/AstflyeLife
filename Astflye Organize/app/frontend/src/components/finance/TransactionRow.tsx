import type { Transaction } from '@/hooks/useFinance'

interface Props { tx: Transaction; onDelete: (id: string) => void }

export function TransactionRow({ tx, onDelete }: Props) {
  const isIncome = tx.type === 'income'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 8,
      background: 'var(--surface)', border: '1px solid rgba(180,85,255,0.08)',
      transition: 'all 0.2s ease', backdropFilter: 'blur(8px)',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,85,255,0.2)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,85,255,0.08)' }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isIncome ? 'rgba(0,232,122,0.1)' : 'rgba(255,51,102,0.1)',
        border: `1px solid ${isIncome ? 'rgba(0,232,122,0.2)' : 'rgba(255,51,102,0.2)'}`,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isIncome ? '#00e87a' : '#ff3366'} strokeWidth="2.5">
          {isIncome
            ? <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
            : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
          }
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tx.description || tx.category}
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 99,
            background: 'rgba(180,85,255,0.08)', color: 'var(--muted)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          }}>{tx.category}</span>
          <span style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: 'var(--font-mono)' }}>
            {new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      </div>

      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, flexShrink: 0,
        color: isIncome ? '#00e87a' : '#ff3366',
        textShadow: `0 0 10px ${isIncome ? 'rgba(0,232,122,0.3)' : 'rgba(255,51,102,0.3)'}`,
      }}>
        {isIncome ? '+' : '-'}R${tx.amount.toFixed(2)}
      </span>

      <button onClick={() => onDelete(tx.id)} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--muted2)', padding: '4px', display: 'flex',
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--muted2)'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>
  )
}
