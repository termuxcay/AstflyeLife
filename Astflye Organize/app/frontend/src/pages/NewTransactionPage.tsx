import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateTransaction } from '@/hooks/useFinance'

const CATEGORIES = {
  income: ['salary', 'freelance', 'investment', 'gift', 'other'],
  expense: ['food', 'transport', 'health', 'entertainment', 'bills', 'education', 'other'],
}

export default function NewTransactionPage() {
  const navigate = useNavigate()
  const createTx = useCreateTransaction()
  const [form, setForm] = useState<{
    type: 'income' | 'expense'; amount: string; category: string;
    description: string; recurring: boolean; frequency: string;
  }>({
    type: 'expense', amount: '', category: 'food', description: '', recurring: false, frequency: 'once',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTx.mutateAsync({ ...form, amount: parseFloat(form.amount) })
    navigate('/finance')
  }

  const inputStyle: React.CSSProperties = {
    background: '#1a0d2e', border: '1px solid #b455ff33',
    borderRadius: 8, padding: '8px 12px', color: '#e0d0ff', width: '100%',
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#b455ff' }}>Add Transaction</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {['income', 'expense'].map(t => (
            <button key={t} type="button" onClick={() => setForm({ ...form, type: t as 'income' | 'expense' })}
              className="py-2 rounded-lg text-sm capitalize font-medium cursor-pointer"
              style={{
                background: form.type === t ? (t === 'income' ? '#b455ff33' : '#ff55aa33') : '#110820',
                border: `1px solid ${form.type === t ? (t === 'income' ? '#b455ff' : '#ff55aa') : '#b455ff22'}`,
                color: form.type === t ? '#e0d0ff' : '#776688',
              }}>
              {t === 'income' ? '↑ Income' : '↓ Expense'}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>AMOUNT (R$) *</label>
          <input style={inputStyle} type="number" step="0.01" min="0.01" value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>CATEGORY</label>
          <select style={inputStyle} value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}>
            {(CATEGORIES[form.type as keyof typeof CATEGORIES] ?? []).map(c =>
              <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#776688' }}>DESCRIPTION</label>
          <input style={inputStyle} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <button type="submit" disabled={createTx.isPending}
          className="py-3 rounded-lg font-semibold text-white cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)' }}>
          {createTx.isPending ? 'Adding...' : 'Add Transaction'}
        </button>
      </form>
    </div>
  )
}
