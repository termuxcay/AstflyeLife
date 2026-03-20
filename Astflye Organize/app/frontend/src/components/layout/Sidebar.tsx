import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

const nav = [
  { href: '/',         icon: '🏠', label: 'Dashboard' },
  { href: '/tasks',    icon: '📋', label: 'Tasks'     },
  { href: '/finance',  icon: '💰', label: 'Finance'   },
  { href: '/social',   icon: '👥', label: 'Social'    },
  { href: '/settings', icon: '⚙️',  label: 'Settings'  },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className="flex flex-col h-full transition-all duration-200"
      style={{
        width: collapsed ? 56 : 180,
        background: '#110820',
        borderRight: '1px solid #b455ff22',
        padding: '16px 8px',
        flexShrink: 0,
      }}
    >
      <div className="flex items-center justify-between mb-6 px-1">
        {!collapsed && (
          <span className="text-xs font-bold tracking-widest" style={{ color: '#b455ff' }}>
            ASTFLYE
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs opacity-40 hover:opacity-80"
          style={{ color: '#b455ff' }}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {nav.map(({ href, icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              to={href}
              className="flex items-center gap-3 px-2 py-2 rounded-lg transition-all"
              style={{
                background: active ? '#b455ff22' : 'transparent',
                border: active ? '1px solid #b455ff44' : '1px solid transparent',
                color: active ? '#e0d0ff' : '#776688',
                textDecoration: 'none',
              }}
            >
              <span className="text-base">{icon}</span>
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
