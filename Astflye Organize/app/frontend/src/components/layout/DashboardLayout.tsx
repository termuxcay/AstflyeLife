import { Sidebar } from './Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--bg)', position: 'relative',
    }}>
      <Sidebar />
      <main style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '28px 32px',
        position: 'relative', zIndex: 1,
      }}>
        {children}
      </main>
    </div>
  )
}
