import type { Task } from '@/hooks/useTasks'

const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  low:    { bg: 'rgba(0,232,122,0.1)',   color: '#00e87a', label: 'low' },
  medium: { bg: 'rgba(180,85,255,0.1)',  color: '#b455ff', label: 'med' },
  high:   { bg: 'rgba(255,170,0,0.12)',  color: '#ffaa00', label: 'high' },
  urgent: { bg: 'rgba(255,51,102,0.12)', color: '#ff3366', label: '!!!' },
}

const RECUR_ICON: Record<string, string> = {
  daily: '↻', weekly: '⟳', monthly: '⊙', yearly: '◎',
}

export function TaskCard({ task, onStatusChange, onDelete }: {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const done = task.status === 'completed'
  const p = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.medium

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 10,
      background: done ? 'rgba(10,6,18,0.4)' : 'var(--surface)',
      border: `1px solid ${done ? 'rgba(180,85,255,0.06)' : 'rgba(180,85,255,0.12)'}`,
      transition: 'all 0.2s ease',
      animation: 'fadeUp 0.3s ease both',
      backdropFilter: 'blur(8px)',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = done ? 'rgba(180,85,255,0.1)' : 'rgba(180,85,255,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = done ? 'rgba(180,85,255,0.06)' : 'rgba(180,85,255,0.12)' }}
    >
      {/* Complete toggle */}
      <button
        aria-label="complete"
        onClick={() => onStatusChange(task.id, done ? 'pending' : 'completed')}
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${done ? 'var(--green)' : 'rgba(180,85,255,0.4)'}`,
          background: done ? 'rgba(0,232,122,0.15)' : 'transparent',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: done ? '0 0 8px rgba(0,232,122,0.3)' : 'none',
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="#00e87a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 14, fontWeight: 500,
            color: done ? 'var(--muted)' : 'var(--text)',
            textDecoration: done ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-body)',
          }}>{task.title}</span>

          {task.recurrence !== 'none' && (
            <span style={{ fontSize: 12, color: 'rgba(180,85,255,0.5)', flexShrink: 0 }}>
              {RECUR_ICON[task.recurrence]}
            </span>
          )}
        </div>
        {task.description && (
          <p style={{ fontSize: 11, color: 'var(--muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.description}
          </p>
        )}
      </div>

      {/* Priority badge */}
      <span style={{
        padding: '2px 8px', borderRadius: 99, flexShrink: 0,
        background: p.bg, color: p.color,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        letterSpacing: '0.05em', textTransform: 'uppercase',
        border: `1px solid ${p.color}33`,
      }}>{p.label}</span>

      {/* Skip */}
      {!done && (
        <button onClick={() => onStatusChange(task.id, 'skipped')} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--muted2)', padding: '4px', borderRadius: 4,
          transition: 'color 0.15s', lineHeight: 1, display: 'flex', alignItems: 'center',
        }}
          title="Skip"
          onMouseEnter={e => e.currentTarget.style.color = '#ffaa00'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted2)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
      )}

      {/* Delete */}
      <button onClick={() => onDelete(task.id)} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--muted2)', padding: '4px', borderRadius: 4,
        transition: 'color 0.15s', display: 'flex', alignItems: 'center',
      }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--muted2)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>
  )
}
