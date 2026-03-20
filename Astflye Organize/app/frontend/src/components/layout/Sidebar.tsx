import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

const nav = [
  {
    href: '/', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ), label: 'Dashboard',
  },
  {
    href: '/tasks', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ), label: 'Tasks',
  },
  {
    href: '/finance', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ), label: 'Finance',
  },
  {
    href: '/social', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ), label: 'Social',
  },
  {
    href: '/profile', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ), label: 'Profile',
  },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? 68 : 220,
      background: 'rgba(10, 6, 18, 0.95)',
      borderRight: '1px solid rgba(180,85,255,0.1)',
      display: 'flex', flexDirection: 'column',
      padding: '20px 10px',
      flexShrink: 0,
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      position: 'relative', zIndex: 10,
    }}>
      {/* Top border accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(180,85,255,0.5), rgba(255,85,170,0.3), transparent)',
      }} />

      {/* Logo area */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        padding: '0 6px', marginBottom: 28,
      }}>
        {!collapsed && (
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
            letterSpacing: '-0.01em', color: 'var(--text)',
          }}>
            <span style={{ color: 'var(--primary)' }}>A</span>stflye
          </span>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(180,85,255,0.15)',
          background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
          fontSize: 12,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,85,255,0.4)'; e.currentTarget.style.color = 'var(--primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,85,255,0.15)'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {nav.map(({ href, icon, label }, i) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link key={href} to={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px' : '9px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              justifyContent: collapsed ? 'center' : 'flex-start',
              position: 'relative',
              background: active ? 'rgba(180,85,255,0.1)' : 'transparent',
              border: active ? '1px solid rgba(180,85,255,0.25)' : '1px solid transparent',
              color: active ? '#e2d4f8' : 'var(--muted)',
              transition: 'all 0.2s ease',
              animation: `fadeUp 0.3s ease both`,
              animationDelay: `${i * 0.06}s`,
              boxShadow: active ? '0 0 12px rgba(180,85,255,0.1)' : 'none',
            }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(180,85,255,0.06)'
                  e.currentTarget.style.color = '#c4a8e8'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--muted)'
                }
              }}
            >
              {/* Active left bar */}
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2,
                  borderRadius: 99, background: 'var(--primary)',
                  boxShadow: '0 0 8px var(--primary)',
                }} />
              )}
              <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
              {!collapsed && (
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom status dot */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 8, padding: '8px 10px',
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: 'var(--green)',
          boxShadow: '0 0 6px var(--green)', flexShrink: 0,
          animation: 'pulse-glow 2s ease-in-out infinite',
        }} />
        {!collapsed && (
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>online</span>
        )}
      </div>
    </aside>
  )
}
