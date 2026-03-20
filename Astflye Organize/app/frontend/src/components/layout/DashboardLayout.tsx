import { Sidebar } from './Sidebar'
import { WindowMinimise, WindowMaximise, WindowHide } from '../../../wailsjs/runtime/runtime'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: 'var(--bg)', position: 'relative',
    }}>
      {/* Custom titlebar */}
      <div
        className="titlebar-drag"
        style={{
          height: 36, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px 0 16px',
          background: 'rgba(6,4,13,0.96)',
          borderBottom: '1px solid rgba(180,85,255,0.1)',
          position: 'relative', zIndex: 20,
        }}
      >
        {/* App name (left) */}
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
          letterSpacing: '-0.01em', color: 'var(--muted)',
          userSelect: 'none',
        }}>
          <span style={{ color: 'var(--primary)' }}>A</span>stflye Life
        </span>

        {/* Window controls (right) */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={WindowMinimise} style={{
            width: 26, height: 20, borderRadius: 4, border: 'none',
            background: 'transparent', color: 'var(--muted2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', fontSize: 14, lineHeight: 1,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(180,85,255,0.12)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted2)' }}
            title="Minimizar"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="5.5" width="10" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </button>
          <button onClick={WindowMaximise} style={{
            width: 26, height: 20, borderRadius: 4, border: 'none',
            background: 'transparent', color: 'var(--muted2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(180,85,255,0.12)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted2)' }}
            title="Maximizar"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </button>
          <button onClick={WindowHide} style={{
            width: 26, height: 20, borderRadius: 4, border: 'none',
            background: 'transparent', color: 'var(--muted2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,51,102,0.15)'; e.currentTarget.style.color = '#ff3366' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted2)' }}
            title="Fechar"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '32px 44px',
          position: 'relative', zIndex: 1,
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
