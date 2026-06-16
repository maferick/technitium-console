import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../lib/api'
import { clientName, num } from '../lib/format'
import { Card, CardHead, Spinner, Empty, Chip } from '../components/ui'

export default function Clients() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => getDashboard('LastDay'), refetchInterval: 15_000 })
  const clients = (data?.topClients || []).filter(c =>
    !q || c.name.includes(q) || (c.domain || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Clients</h1>
        <span className="font-mono text-xs text-mut">last 24h · {data?.topClients.length || 0} active</span>
      </div>
      <Card>
        <CardHead title="Active clients" right={<input className="input w-56" placeholder="filter by name or IP…" value={q} onChange={e => setQ(e.target.value)} />} />
        {isLoading ? <Spinner /> : clients.length === 0 ? <Empty>No clients.</Empty> :
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
                <th className="px-5 py-3">Device</th><th className="px-5 py-3">IP address</th><th className="px-5 py-3 text-right">Queries (24h)</th>
              </tr></thead>
              <tbody>
                {clients.map((c, i) => { const n = clientName(c); return (
                  <tr key={i} className="border-t border-line hover:bg-surface2">
                    <td className="px-5 py-2.5 font-mono text-[13px] text-txt">{n.primary}{c.rateLimited && <Chip className="ml-2 text-warn bg-warn/10">rate-limited</Chip>}</td>
                    <td className="px-5 py-2.5 font-mono text-[13px] text-dim">{c.name}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-[13px] font-semibold tabular-nums">{num(c.hits)}</td>
                  </tr>) })}
              </tbody>
            </table>
          </div>}
      </Card>
    </div>
  )
}
