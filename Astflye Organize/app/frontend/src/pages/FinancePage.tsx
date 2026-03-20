import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions, useSummary, useDeleteTransaction } from '@/hooks/useFinance'
import { TransactionRow } from '@/components/finance/TransactionRow'
import { SummaryChart } from '@/components/finance/SummaryChart'

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly']
const PERIOD_LABEL: Record<string, string> = {
  daily: 'Hoje', weekly: '7 dias', monthly: 'Este mês', yearly: 'Este ano',
}

function filterByPeriod(date: string, period: string) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  switch (period) {
    case 'daily':   return date === today
    case 'weekly': {
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7)
      return date >= cutoff.toISOString().slice(0, 10)
    }
    case 'monthly': return date.slice(0, 7) === today.slice(0, 7)
    case 'yearly':  return date.slice(0, 4) === today.slice(0, 4)
    default:        return true
  }
}

export default function FinancePage() {
  const [period, setPeriod] = useState('monthly')
  const { data: allTransactions } = useTransactions()
  const { data: summary } = useSummary(period)
  const deleteTransaction = useDeleteTransaction()

  const transactions = useMemo(
    () => allTransactions?.filter(tx => filterByPeriod(tx.date, period)) ?? [],
    [allTransactions, period],
  )
  const recurring = useMemo(
    () => allTransactions?.filter(tx => tx.recurring) ?? [],
    [allTransactions],
  )

  const chartData = [{ name: PERIOD_LABEL[period] ?? period, income: summary?.income ?? 0, expenses: summary?.expenses ?? 0 }]
  const balance = summary?.balance ?? 0

  const SummaryCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div style={{
      padding: '16px 18px', borderRadius: 10,
      background: 'var(--surface)', border: '1px solid rgba(180,85,255,0.1)',
      backdropFilter: 'blur(8px)',
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color, textShadow: `0 0 16px ${color}55`, lineHeight: 1 }}>
        R${value.toFixed(2)}
      </p>
    </div>
  )

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Header */}
      <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>finanças</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Finanças</h1>
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

      {/* Period filter */}
      <div className="anim-fade-up delay-1" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {PERIODS.map(p => {
          const active = period === p
          return (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '5px 14px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              background: active ? 'rgba(180,85,255,0.15)' : 'rgba(13,8,24,0.6)',
              border: `1px solid ${active ? 'rgba(180,85,255,0.5)' : 'rgba(180,85,255,0.1)'}`,
              color: active ? '#e2d4f8' : 'var(--muted)', transition: 'all 0.15s',
              boxShadow: active ? '0 0 10px rgba(180,85,255,0.15)' : 'none',
            }}>{PERIOD_LABEL[p]}</button>
          )
        })}
      </div>

      {/* Summary cards */}
      <div className="anim-fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <SummaryCard label="Receita"   value={summary?.income ?? 0}   color="#b455ff" />
        <SummaryCard label="Despesas" value={summary?.expenses ?? 0} color="#ff3366" />
        <SummaryCard label="Saldo"    value={balance} color={balance >= 0 ? '#00e87a' : '#ff3366'} />
      </div>

      {/* Chart */}
      <div className="glass anim-fade-up delay-3" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <SummaryChart data={chartData} />
      </div>

      {/* Recurring section */}
      {recurring.length > 0 && (
        <div className="anim-fade-up delay-3" style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            Recorrentes ({recurring.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recurring.map(tx => (
              <TransactionRow key={tx.id} tx={tx} onDelete={(id) => deleteTransaction.mutate(id)} />
            ))}
          </div>
        </div>
      )}

      {/* Transactions for period */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Transações — {PERIOD_LABEL[period]} ({transactions.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {transactions.map(tx => (
            <TransactionRow key={tx.id} tx={tx} onDelete={(id) => deleteTransaction.mutate(id)} />
          ))}
          {transactions.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              border: '1px dashed rgba(180,85,255,0.15)', borderRadius: 12,
            }}>
              <p style={{ fontSize: 24, marginBottom: 10 }}>💰</p>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Sem transações no período.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
