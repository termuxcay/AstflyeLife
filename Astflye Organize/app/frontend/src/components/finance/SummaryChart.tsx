import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface Props { data: { name: string; income: number; expenses: number }[] }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(13,8,24,0.95)', border: '1px solid rgba(180,85,255,0.2)',
      borderRadius: 8, padding: '10px 14px', backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: p.fill, marginBottom: 2 }}>
          {p.name === 'income' ? 'Income' : 'Expenses'}: R${p.value.toFixed(2)}
        </p>
      ))}
    </div>
  )
}

export function SummaryChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,85,255,0.06)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(180,85,255,0.05)' }} />
        <Bar dataKey="income"   fill="#b455ff" radius={[4,4,0,0]} opacity={0.85} />
        <Bar dataKey="expenses" fill="#ff3366" radius={[4,4,0,0]} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  )
}
