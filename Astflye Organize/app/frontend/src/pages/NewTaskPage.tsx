import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateTask } from '@/hooks/useTasks'
import { playSound } from '@/lib/sounds'

export default function NewTaskPage() {
  const navigate = useNavigate()
  const createTask = useCreateTask()

  type Priority = 'low' | 'medium' | 'high' | 'urgent'
  type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  const [form, setForm] = useState<{
    title: string; description: string; status: string; priority: Priority
    recurrence: Recurrence; category: string; due_date: string; due_time: string; notify_before: number
  }>({
    title: '', description: '', status: 'pending', priority: 'medium',
    recurrence: 'none', category: '', due_date: '', due_time: '', notify_before: 5,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTask.mutateAsync(form)
    playSound('taskCreate')
    navigate('/tasks')
  }

  const Label = ({ children }: { children: string }) => (
    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  )

  const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']
  const PRIO_COLOR: Record<Priority, string> = { low: '#00e87a', medium: '#b455ff', high: '#ffaa00', urgent: '#ff3366' }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="anim-fade-up" style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>tasks / new</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>New Task</h1>
      </div>

      <form onSubmit={handleSubmit} className="anim-fade-up delay-1" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <Label>Title *</Label>
          <input className="input-neon" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} required
            placeholder="What needs to be done?" />
        </div>

        <div>
          <Label>Description</Label>
          <textarea className="input-neon" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Optional details..."
            style={{ minHeight: 80, resize: 'vertical' }} />
        </div>

        {/* Priority selector */}
        <div>
          <Label>Priority</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {PRIORITIES.map(p => {
              const active = form.priority === p
              const c = PRIO_COLOR[p]
              return (
                <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })} style={{
                  padding: '7px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: active ? `${c}20` : 'rgba(13,8,24,0.6)',
                  border: `1px solid ${active ? `${c}55` : 'rgba(180,85,255,0.1)'}`,
                  color: active ? c : 'var(--muted)',
                  transition: 'all 0.15s',
                  boxShadow: active ? `0 0 12px ${c}33` : 'none',
                }}>{p}</button>
              )
            })}
          </div>
        </div>

        {/* Due date + time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <Label>Due Date</Label>
            <input type="date" className="input-neon" value={form.due_date}
              onChange={e => setForm({ ...form, due_date: e.target.value })}
              style={{ colorScheme: 'dark' }} />
          </div>
          <div>
            <Label>Due Time</Label>
            <input type="time" className="input-neon" value={form.due_time}
              onChange={e => setForm({ ...form, due_time: e.target.value })}
              style={{ colorScheme: 'dark' }} />
          </div>
        </div>

        {/* Notify before */}
        <div>
          <Label>Notify Before (minutes)</Label>
          <input type="number" className="input-neon" value={form.notify_before} min={1} max={1440}
            onChange={e => setForm({ ...form, notify_before: Number(e.target.value) })}
            placeholder="5" />
        </div>

        {/* Recurrence + Category */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <Label>Recurrence</Label>
            <select className="input-neon" value={form.recurrence}
              onChange={e => setForm({ ...form, recurrence: e.target.value as Recurrence })}>
              {['none', 'daily', 'weekly', 'monthly', 'yearly'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <Label>Category</Label>
            <input className="input-neon" value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="health, work…" />
          </div>
        </div>

        <button type="submit" disabled={createTask.isPending} className="btn-neon" style={{
          width: '100%', padding: '12px', fontSize: 14, marginTop: 4,
          opacity: createTask.isPending ? 0.7 : 1,
        }}>
          {createTask.isPending ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  )
}
