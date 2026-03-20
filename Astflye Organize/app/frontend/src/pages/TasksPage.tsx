import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTasks, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks'
import { TaskCard } from '@/components/tasks/TaskCard'

const FILTERS = ['all', 'pending', 'in_progress', 'completed', 'skipped']

export default function TasksPage() {
  const [filter, setFilter] = useState<string | undefined>()
  const { data: tasks, isLoading } = useTasks(filter ? { status: filter } : undefined)
  const updateStatus = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#b455ff' }}>Tasks</h1>
        <Link
          to="/tasks/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)', textDecoration: 'none' }}
        >
          + New Task
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f === 'all' ? undefined : f)}
            className="px-3 py-1 rounded-full text-xs capitalize cursor-pointer transition-all"
            style={{
              background: (filter ?? 'all') === f ? '#b455ff33' : '#110820',
              border: `1px solid ${(filter ?? 'all') === f ? '#b455ff' : '#b455ff22'}`,
              color: (filter ?? 'all') === f ? '#e0d0ff' : '#776688',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && <p style={{ color: '#776688' }}>Loading...</p>}

      <div className="flex flex-col gap-2">
        {tasks?.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            onDelete={(id) => deleteTask.mutate(id)}
          />
        ))}
        {!isLoading && tasks?.length === 0 && (
          <p className="text-center py-10" style={{ color: '#554466' }}>
            No tasks yet. Create your first one!
          </p>
        )}
      </div>
    </div>
  )
}
