import { useState } from 'react'
import type { Task } from '@/hooks/useTasks'
import { TaskCard } from './TaskCard'

const COLUMNS: { status: string; label: string; color: string }[] = [
  { status: 'pending',     label: 'Pendente',     color: '#b455ff' },
  { status: 'in_progress', label: 'Em Progresso', color: '#ffaa00' },
  { status: 'completed',   label: 'Concluído',    color: '#00e87a' },
  { status: 'skipped',     label: 'Pulado',       color: '#6b5880' },
]

export function KanbanBoard({
  tasks,
  onStatusChange,
  onDelete,
}: {
  tasks: Task[]
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const [dragOver, setDragOver] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', overflow: 'auto', paddingBottom: 8 }}>
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status)
        return (
          <div
            key={col.status}
            className={`kanban-col${dragOver === col.status ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(col.status) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(null)
              const id = e.dataTransfer.getData('taskId')
              if (id) onStatusChange(id, col.status)
            }}
          >
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  {col.label}
                </span>
              </div>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                background: `${col.color}18`, color: col.color,
                padding: '1px 6px', borderRadius: 99, border: `1px solid ${col.color}33`,
              }}>
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 60 }}>
              {colTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('taskId', task.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <TaskCard task={task} onStatusChange={onStatusChange} onDelete={onDelete} />
                </div>
              ))}
              {colTasks.length === 0 && (
                <div style={{
                  padding: '16px 8px', textAlign: 'center',
                  border: '1px dashed rgba(180,85,255,0.1)', borderRadius: 8,
                  color: 'var(--muted2)', fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}>
                  drop here
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
