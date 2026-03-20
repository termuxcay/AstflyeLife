import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface Props { data: { name: string; income: number; expenses: number }[] }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(13,8,24,0.96)', border: '1px solid rgba(180,85,255,0.22)',
      borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: p.stroke, marginBottom: 2 }}>
          {p.name === 'income' ? 'Receita' : 'Despesas'}: R${Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  )
}

export function SummaryChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#b455ff" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#b455ff" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff3366" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ff3366" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,85,255,0.05)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--muted)' as string, fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--muted)' as string, fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(180,85,255,0.15)', strokeWidth: 1 }} />
        <Area
          type="monotone" dataKey="income"
          stroke="#b455ff" strokeWidth={2}
          fill="url(#gradIncome)"
          dot={false} activeDot={{ r: 4, fill: '#b455ff', strokeWidth: 0 }}
        />
        <Area
          type="monotone" dataKey="expenses"
          stroke="#ff3366" strokeWidth={2}
          fill="url(#gradExpenses)"
          dot={false} activeDot={{ r: 4, fill: '#ff3366', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
