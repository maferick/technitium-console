import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { getDashboard } from '../lib/api'
import { num, pct } from '../lib/format'
import { Card, CardHead, RankRow, Spinner, Empty } from '../components/ui'

export default function Blocking() {
  const { data, isLoading } = useQuery({ queryKey: ['blocking'], queryFn: () => getDashboard('LastDay'), refetchInterval: 15_000 })
  if (isLoading || !data) return <Spinner label="Loading…" />
  const s = data.stats
  const maxB = Math.max(...data.topBlockedDomains.map(b => b.hits), 1)
  const tiles = [
    { label: 'Blocked (24h)', value: num(s.totalBlocked), sub: pct(s.totalBlocked, s.totalQueries || 1) + ' of queries', color: '#fbbf24' },
    { label: 'Block-list rules', value: num(s.blockListZones), sub: 'domains on lists', color: '#a3e635' },
    { label: 'Allow-list rules', value: num(s.allowListZones), sub: 'exceptions', color: '#34d399' },
  ]
  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight"><ShieldCheck size={20} className="text-warn" /> Blocking</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map(t => (
          <div key={t.label} className="card p-4" style={{ borderTop: `2px solid ${t.color}` }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-mut">{t.label}</div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums" style={{ color: t.color }}>{t.value}</div>
            <div className="font-mono text-[11px] text-dim">{t.sub}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHead title="Most-blocked domains (24h)" />
        {data.topBlockedDomains.length === 0 ? <Empty>Nothing blocked in the last 24h.</Empty> :
          data.topBlockedDomains.slice(0, 15).map((b, i) => <RankRow key={i} primary={b.name} value={b.hits} max={maxB} />)}
      </Card>
    </div>
  )
}
