import { Sidebar } from './Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#08050f' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto p-6" style={{ color: '#e0d0ff' }}>
        {children}
      </main>
    </div>
  )
}
