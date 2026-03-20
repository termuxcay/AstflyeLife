import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions, useSummary, useDeleteTransaction } from '@/hooks/useFinance'
import { TransactionRow } from '@/components/finance/TransactionRow'
import { SummaryChart } from '@/components/finance/SummaryChart'

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly']

export default function FinancePage() {
  const [period, setPeriod] = useState('monthly')
  const { data: transactions } = useTransactions()
  const { data: summary } = useSummary(period)
  const deleteTransaction = useDeleteTransaction()

  const chartData = [{ name: period, income: summary?.income ?? 0, expenses: summary?.expenses ?? 0 }]
  const balance = summary?.balance ?? 0

  const SummaryCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div style={{
      padding: '14px 16px', borderRadius: 10,
      background: 'var(--surface)', border: '1px solid rgba(180,85,255,0.1)',
      backdropFilter: 'blur(8px)',
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color, textShadow: `0 0 16px ${color}55`, lineHeight: 1 }}>
        R${value.toFixed(2)}
      </p>
    </div>
  )

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>finance</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Finance</h1>
        </div>
        <Link to="/finance/new" style={{
          padding: '8px 18px', borderRadius: 8, textDecoration: 'none',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: '#fff',
          background: 'linear-gradient(135deg, #b455ff, #ff55aa)',
          boxShadow: '0 4px 14px rgba(180,85,255,0.3)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.2s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(180,85,255,0.45)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(180,85,255,0.3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add
        </Link>
      </div>

      {/* Summary cards */}
      <div className="anim-fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <SummaryCard label="Income"   value={summary?.income ?? 0}   color="#b455ff" />
        <SummaryCard label="Expenses" value={summary?.expenses ?? 0} color="#ff3366" />
        <SummaryCard label="Balance"  value={balance} color={balance >= 0 ? '#00e87a' : '#ff3366'} />
      </div>

      {/* Period filter */}
      <div className="anim-fade-up delay-2" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {PERIODS.map(p => {
          const active = period === p
          return (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 12px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'capitalize',
              background: active ? 'rgba(180,85,255,0.15)' : 'rgba(13,8,24,0.6)',
              border: `1px solid ${active ? 'rgba(180,85,255,0.5)' : 'rgba(180,85,255,0.1)'}`,
              color: active ? '#e2d4f8' : 'var(--muted)', transition: 'all 0.15s',
              boxShadow: active ? '0 0 10px rgba(180,85,255,0.15)' : 'none',
            }}>{p}</button>
          )
        })}
      </div>

      {/* Chart */}
      <div className="glass anim-fade-up delay-3" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <SummaryChart data={chartData} />
      </div>

      {/* Transactions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {transactions?.map(tx => (
          <TransactionRow key={tx.id} tx={tx} onDelete={(id) => deleteTransaction.mutate(id)} />
        ))}
        {transactions?.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            border: '1px dashed rgba(180,85,255,0.15)', borderRadius: 12,
          }}>
            <p style={{ fontSize: 28, marginBottom: 12 }}>💰</p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No transactions yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
