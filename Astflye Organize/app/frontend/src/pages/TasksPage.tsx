import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTasks, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks'
import { TaskCard } from '@/components/tasks/TaskCard'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'

const FILTERS = ['all', 'pending', 'in_progress', 'completed', 'skipped']

export default function TasksPage() {
  const [filter, setFilter] = useState<string | undefined>()
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const { data: allTasks, isLoading } = useTasks()
  const tasks = filter && filter !== 'all'
    ? allTasks?.filter(t => t.status === filter)
    : allTasks
  const updateStatus = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()

  return (
    <div style={{ maxWidth: view === 'kanban' ? '100%' : 820, margin: '0 auto' }}>
      {/* Header */}
      <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>tasks</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Minhas Tarefas</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'rgba(13,8,24,0.7)', border: '1px solid rgba(180,85,255,0.15)', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['list', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: view === v ? 'rgba(180,85,255,0.2)' : 'transparent',
                color: view === v ? '#e2d4f8' : 'var(--muted)',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                transition: 'all 0.15s',
              }}>{v}</button>
            ))}
          </div>
          <Link to="/tasks/new" style={{
            padding: '8px 18px', borderRadius: 8, textDecoration: 'none',
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: '#fff',
            background: 'linear-gradient(135deg, #b455ff, #ff55aa)',
            boxShadow: '0 4px 14px rgba(180,85,255,0.3)',
            transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(180,85,255,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(180,85,255,0.3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Task
          </Link>
        </div>
      </div>

      {/* Filter pills (list view only) */}
      {view === 'list' && (
        <div className="anim-fade-up delay-1" style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = (filter ?? 'all') === f
            return (
              <button key={f} onClick={() => setFilter(f === 'all' ? undefined : f)} style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase',
                background: active ? 'rgba(180,85,255,0.15)' : 'rgba(13,8,24,0.6)',
                border: `1px solid ${active ? 'rgba(180,85,255,0.5)' : 'rgba(180,85,255,0.1)'}`,
                color: active ? '#e2d4f8' : 'var(--muted)',
                transition: 'all 0.15s ease',
                boxShadow: active ? '0 0 10px rgba(180,85,255,0.15)' : 'none',
              }}>
                {f.replace('_', ' ')}
              </button>
            )
          })}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '20px 0', color: 'var(--muted)' }}>
          <div style={{ width: 16, height: 16, border: '2px solid rgba(180,85,255,0.3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</span>
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && !isLoading && (
        <div className="anim-fade-up delay-1">
          <KanbanBoard
            tasks={allTasks ?? []}
            onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            onDelete={(id) => deleteTask.mutate(id)}
          />
        </div>
      )}

      {/* List view */}
      {view === 'list' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks?.map((task, i) => (
            <div key={task.id} className="anim-fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
              <TaskCard
                task={task}
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                onDelete={(id) => deleteTask.mutate(id)}
              />
            </div>
          ))}
          {tasks?.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: '1px dashed rgba(180,85,255,0.15)', borderRadius: 12,
            }}>
              <p style={{ fontSize: 28, marginBottom: 12 }}>📋</p>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No tasks yet.</p>
              <p style={{ color: 'var(--muted2)', fontSize: 12, marginTop: 4 }}>Create your first one!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
