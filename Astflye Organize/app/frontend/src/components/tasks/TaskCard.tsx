import type { Task } from '@/hooks/useTasks'

const priorityColors: Record<string, string> = {
  low: '#555577', medium: '#776688', high: '#b455ff', urgent: '#ff55aa',
}
const statusColors: Record<string, string> = {
  pending: '#776688', in_progress: '#b455ff', completed: '#00cc77', skipped: '#444',
}

interface Props {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}

export function TaskCard({ task, onStatusChange, onDelete }: Props) {
  const isCompleted = task.status === 'completed'
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg transition-all"
      style={{
        background: '#110820',
        border: `1px solid ${isCompleted ? '#00cc7733' : '#b455ff22'}`,
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      <button
        aria-label="complete"
        onClick={() => onStatusChange(task.id, isCompleted ? 'pending' : 'completed')}
        className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all cursor-pointer"
        style={{
          borderColor: statusColors[task.status] ?? '#776688',
          background: isCompleted ? '#00cc77' : 'transparent',
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: '#e0d0ff', textDecoration: isCompleted ? 'line-through' : 'none' }}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: (priorityColors[task.priority] ?? '#776688') + '33',
              color: priorityColors[task.priority] ?? '#776688',
            }}
          >
            {task.priority}
          </span>
          {task.recurrence !== 'none' && (
            <span className="text-xs" style={{ color: '#554466' }}>↻ {task.recurrence}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        {!isCompleted && (
          <button
            onClick={() => onStatusChange(task.id, 'skipped')}
            className="text-xs px-2 py-1 rounded opacity-40 hover:opacity-70 cursor-pointer"
            style={{ color: '#776688' }}
          >
            skip
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs px-2 py-1 rounded opacity-40 hover:opacity-70 cursor-pointer"
          style={{ color: '#ff4466' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
