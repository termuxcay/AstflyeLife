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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#b455ff' }}>Finance</h1>
        <Link to="/finance/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #b455ff, #ff55aa)', textDecoration: 'none' }}>
          + Add
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Income', value: summary?.income ?? 0, color: '#b455ff' },
          { label: 'Expenses', value: summary?.expenses ?? 0, color: '#ff55aa' },
          { label: 'Balance', value: summary?.balance ?? 0, color: (summary?.balance ?? 0) >= 0 ? '#00cc77' : '#ff4466' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-xl"
            style={{ background: '#110820', border: '1px solid #b455ff22' }}>
            <p className="text-xs mb-1" style={{ color: '#554466' }}>{label}</p>
            <p className="text-lg font-bold" style={{ color }}>R$ {value.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className="px-3 py-1 rounded-full text-xs capitalize cursor-pointer"
            style={{
              background: period === p ? '#b455ff33' : '#110820',
              border: `1px solid ${period === p ? '#b455ff' : '#b455ff22'}`,
              color: period === p ? '#e0d0ff' : '#776688',
            }}>
            {p}
          </button>
        ))}
      </div>

      <div className="mb-6 p-4 rounded-xl" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
        <SummaryChart data={chartData} />
      </div>

      <div className="flex flex-col gap-2">
        {transactions?.map(tx => (
          <TransactionRow key={tx.id} tx={tx} onDelete={(id) => deleteTransaction.mutate(id)} />
        ))}
        {transactions?.length === 0 && (
          <p className="text-center py-10" style={{ color: '#554466' }}>No transactions yet.</p>
        )}
      </div>
    </div>
  )
}
