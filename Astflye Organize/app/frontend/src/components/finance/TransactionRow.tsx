import type { Transaction } from '@/hooks/useFinance'

interface Props {
  tx: Transaction
  onDelete: (id: string) => void
}

export function TransactionRow({ tx, onDelete }: Props) {
  const isIncome = tx.type === 'income'
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg"
      style={{ background: '#110820', border: '1px solid #b455ff11' }}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: isIncome ? '#b455ff22' : '#ff55aa22' }}
      >
        {isIncome ? '↑' : '↓'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#e0d0ff' }}>
          {tx.description || tx.category}
        </p>
        <p className="text-xs" style={{ color: '#554466' }}>{tx.category}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold" style={{ color: isIncome ? '#b455ff' : '#ff55aa' }}>
          {isIncome ? '+' : '-'}R$ {tx.amount.toFixed(2)}
        </p>
        <p className="text-xs" style={{ color: '#554466' }}>
          {new Date(tx.date).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <button onClick={() => onDelete(tx.id)}
        className="text-xs opacity-30 hover:opacity-70 ml-2 cursor-pointer"
        style={{ color: '#ff4466' }}>✕</button>
    </div>
  )
}
