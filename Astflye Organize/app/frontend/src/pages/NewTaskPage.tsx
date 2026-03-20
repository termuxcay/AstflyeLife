import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateTask } from '@/hooks/useTasks'

export default function NewTaskPage() {
  const navigate = useNavigate()
  const createTask = useCreateTask()
  type Priority = 'low' | 'medium' | 'high' | 'urgent'
  type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  const [form, setForm] = useState<{
    title: string; description: string; priority: Priority; recurrence: Recurrence; category: string;
  }>({
    title: '', description: '', priority: 'medium', recurrence: 'none', category: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTask.mutateAsync(form)
    navigate('/tasks')
  }

  const inputStyle: React.CSSProperties = {
    background: '#1a0d2e', border: '1px solid #b455ff33',
    borderRadius: 8, padding: '8px 12px', color: '#e0d0ff', width: '100%', outline: 'none',
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#b455ff' }}>New Task</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>TITLE *</label>
          <input style={inputStyle} value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>DESCRIPTION</label>
          <textarea style={{ ...inputStyle, minHeight: 80 }} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: '#776688' }}>PRIORITY</label>
            <select style={inputStyle} value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>
              {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: '#776688' }}>RECURRENCE</label>
            <select style={inputStyle} value={form.recurrence}
              onChange={e => setForm({ ...form, recurrence: e.target.value as Recurrence })}>
              {['none', 'daily', 'weekly', 'monthly', 'yearly'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>CATEGORY</label>
          <input style={inputStyle} value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            placeholder="e.g. health, work, personal" />
        </div>
        <button type="submit" disabled={createTask.isPending}
          className="py-3 rounded-lg font-semibold text-white mt-2 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}>
          {createTask.isPending ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  )
}
