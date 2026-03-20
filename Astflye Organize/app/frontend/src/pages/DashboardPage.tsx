import { useMe } from '@/hooks/useMe'
import { useTasks } from '@/hooks/useTasks'
import { useSummary } from '@/hooks/useFinance'

export default function DashboardPage() {
  const { data: me } = useMe()
  const { data: todayTasks } = useTasks({ recurrence: 'daily' })
  const { data: summary } = useSummary('monthly')

  const completed = todayTasks?.filter(t => t.status === 'completed').length ?? 0
  const total = todayTasks?.length ?? 0
  const progress = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#b455ff' }}>
          Hey, {me?.username ?? '...'} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: '#776688' }}>Here's your day at a glance.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'STREAK', value: me?.current_streak ?? 0, unit: 'days', color: '#b455ff' },
          { label: 'TODAY', value: `${completed}/${total}`, unit: 'tasks done', color: '#ff55aa' },
          {
            label: 'BALANCE',
            value: `R$${((summary?.balance ?? 0) / 1000).toFixed(1)}k`,
            unit: 'this month',
            color: (summary?.balance ?? 0) >= 0 ? '#00cc77' : '#ff4466',
          },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="p-4 rounded-xl"
            style={{ background: '#110820', border: '1px solid #b455ff22' }}>
            <p className="text-xs" style={{ color: '#554466' }}>{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
            <p className="text-xs" style={{ color: '#554466' }}>{unit}</p>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl" style={{ background: '#110820', border: '1px solid #b455ff22' }}>
        <div className="flex justify-between mb-2">
          <span className="text-xs" style={{ color: '#776688' }}>DAILY PROGRESS</span>
          <span className="text-xs font-bold" style={{ color: '#b455ff' }}>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a0d2e' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #b455ff, #ff55aa)',
              boxShadow: '0 0 8px #b455ff',
            }}
          />
        </div>
        {progress === 100 && total > 0 && (
          <p className="text-xs mt-2 text-center" style={{ color: '#b455ff' }}>
            🔥 All done! You crushed today.
          </p>
        )}
      </div>
    </div>
  )
}
