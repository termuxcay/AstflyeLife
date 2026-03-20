import { useEffect, useState } from 'react'

export interface ToastMessage {
  id: string
  title: string
  body?: string
  type?: 'info' | 'warning' | 'success'
}

interface ToastProps {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true)
      setTimeout(onDismiss, 260)
    }, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const colors = {
    info:    { bg: 'rgba(180,85,255,0.12)', border: 'rgba(180,85,255,0.35)', icon: '#b455ff' },
    warning: { bg: 'rgba(255,170,0,0.10)', border: 'rgba(255,170,0,0.35)',   icon: '#ffaa00' },
    success: { bg: 'rgba(0,232,122,0.10)', border: 'rgba(0,232,122,0.35)',   icon: '#00e87a' },
  }
  const c = colors[msg.type ?? 'info']

  return (
    <div
      className={exiting ? 'toast-exit' : 'toast-enter'}
      onClick={() => { setExiting(true); setTimeout(onDismiss, 260) }}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        backdropFilter: 'blur(14px)',
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        minWidth: 260,
        maxWidth: 320,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${c.icon}22`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: c.icon,
          boxShadow: `0 0 8px ${c.icon}`,
          flexShrink: 0, marginTop: 5,
        }} />
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--text)', lineHeight: 1.3 }}>
            {msg.title}
          </p>
          {msg.body && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>
              {msg.body}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function ToastContainer({ messages, onDismiss }: ToastProps) {
  if (messages.length === 0) return null
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999,
    }}>
      {messages.map(msg => (
        <ToastItem key={msg.id} msg={msg} onDismiss={() => onDismiss(msg.id)} />
      ))}
    </div>
  )
}
