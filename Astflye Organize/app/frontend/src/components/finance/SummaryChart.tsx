import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface Props {
  data: { name: string; income: number; expenses: number }[]
}

export function SummaryChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#b455ff11" />
        <XAxis dataKey="name" tick={{ fill: '#776688', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#776688', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#110820', border: '1px solid #b455ff33', borderRadius: 8 }}
          labelStyle={{ color: '#b455ff' }}
          itemStyle={{ color: '#e0d0ff' }}
        />
        <Bar dataKey="income" fill="#b455ff" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="#ff55aa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
