import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateTransaction } from '@/hooks/useFinance'
import { playSound } from '@/lib/sounds'

const CATEGORIES = {
  income:  ['salary', 'freelance', 'investment', 'gift', 'other'],
  expense: ['food', 'transport', 'health', 'entertainment', 'bills', 'education', 'other'],
}

const RECURRING_PERIODS = ['none', 'daily', 'weekly', 'monthly', 'yearly']
const PERIOD_LABEL: Record<string, string> = {
  none: 'Não recorrente', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual',
}

export default function NewTransactionPage() {
  const navigate = useNavigate()
  const createTx = useCreateTransaction()
  const [form, setForm] = useState<{
    type: 'income' | 'expense'; amount: string; category: string;
    description: string; recurring: boolean; recurring_period: string; currency: string; date: string;
  }>({
    type: 'expense', amount: '', category: 'food', description: '',
    recurring: false, recurring_period: 'none', currency: 'BRL',
    date: new Date().toISOString().slice(0, 10),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTx.mutateAsync({
      ...form,
      amount: parseFloat(form.amount),
      recurring: form.recurring_period !== 'none',
      recurring_period: form.recurring_period === 'none' ? '' : form.recurring_period,
    })
    playSound('expenseAdd')
    navigate('/finance')
  }

  const Label = ({ children }: { children: string }) => (
    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="anim-fade-up" style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>finance / new</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Add Transaction</h1>
      </div>

      <form onSubmit={handleSubmit} className="anim-fade-up delay-1" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Income / Expense toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['income', 'expense'] as const).map(t => {
            const active = form.type === t
            const color = t === 'income' ? '#b455ff' : '#ff3366'
            return (
              <button key={t} type="button" onClick={() => setForm({ ...form, type: t, category: CATEGORIES[t][0] })} style={{
                padding: '12px', borderRadius: 10, cursor: 'pointer',
                background: active ? `${color}18` : 'rgba(13,8,24,0.6)',
                border: `1px solid ${active ? `${color}55` : 'rgba(180,85,255,0.1)'}`,
                color: active ? color : 'var(--muted)',
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
                transition: 'all 0.15s', boxShadow: active ? `0 0 16px ${color}33` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  {t === 'income'
                    ? <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
                    : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                  }
                </svg>
                {t === 'income' ? 'Receita' : 'Despesa'}
              </button>
            )
          })}
        </div>

        <div>
          <Label>Valor (R$) *</Label>
          <input className="input-neon" type="number" step="0.01" min="0.01"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })} required
            placeholder="0.00"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 18 }} />
        </div>

        <div>
          <Label>Categoria</Label>
          <select className="input-neon" value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES[form.type].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <Label>Descrição</Label>
          <input className="input-neon" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Nota opcional..." />
        </div>

        <div>
          <Label>Data</Label>
          <input type="date" className="input-neon" value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            style={{ colorScheme: 'dark' }} />
        </div>

        {/* Recurring period */}
        <div>
          <Label>Recorrência</Label>
          <select className="input-neon" value={form.recurring_period}
            onChange={e => setForm({ ...form, recurring_period: e.target.value })}>
            {RECURRING_PERIODS.map(p => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
          </select>
        </div>

        <button type="submit" disabled={createTx.isPending} className="btn-neon" style={{
          width: '100%', padding: '12px', fontSize: 14, marginTop: 4,
          opacity: createTx.isPending ? 0.7 : 1,
        }}>
          {createTx.isPending ? 'Adicionando...' : 'Adicionar'}
        </button>
      </form>
    </div>
  )
}
