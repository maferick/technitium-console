import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  getDashboard, getTopStats, StatRange, DashboardResponse, TopItem, TopStatsType,
  addBlocked, addAllowed, temporarilyDisableBlocking, forceUpdateBlockLists, setBlockingEnabled,
} from '../lib/api'
import { num, pct, clientName, STAT_TILES } from '../lib/format'
import { Card, CardHead, RankRow, Spinner, Empty, Menu, MenuItem, Modal, toast } from '../components/ui'

type ListKind = 'clients' | 'domains' | 'blocked'
const STATS_TYPE: Record<ListKind, TopStatsType> = { clients: 'TopClients', domains: 'TopDomains', blocked: 'TopBlockedDomains' }

const RANGES: { v: StatRange; label: string }[] = [
  { v: 'LastHour', label: 'Hour' }, { v: 'LastDay', label: 'Day' },
  { v: 'LastWeek', label: 'Week' }, { v: 'LastMonth', label: 'Month' }, { v: 'LastYear', label: 'Year' },
]
const DONUT = ['#bef264', '#22d3ee', '#a78bfa', '#fbbf24', '#64748b']

export default function Dashboard() {
  const [range, setRange] = useState<StatRange>('LastHour')
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', range],
    queryFn: () => getDashboard(range),
    refetchInterval: 10_000,
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">Overview</h1>
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {RANGES.map(r => (
            <button key={r.v} onClick={() => setRange(r.v)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                range === r.v ? 'bg-surface3 text-accent shadow-[0_1px_0_rgba(255,255,255,.05)_inset]' : 'text-dim hover:text-white'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? <Spinner label="Loading metrics…" /> : <Body d={data} range={range} />}
    </div>
  )
}

function Body({ d, range }: { d: DashboardResponse; range: StatRange }) {
  const total = d.stats.totalQueries || 1
  // build series for the area chart
  const find = (l: string) => d.mainChartData.datasets.find(x => x.label === l)?.data || []
  const tot = find('Total'), blk = find('Blocked'), cac = find('Cached')
  const series = d.mainChartData.labels.map((t, i) => ({ t, total: tot[i] ?? 0, blocked: blk[i] ?? 0, cached: cac[i] ?? 0 }))
  const respData = d.queryResponseChartData.labels.map((name, i) => ({ name, value: d.queryResponseChartData.datasets[0]?.data[i] ?? 0 }))
  const respTotal = respData.reduce((a, b) => a + b.value, 0) || 1

  return (
    <div className="space-y-5">
      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {STAT_TILES.map(t => {
          const v = (d.stats as any)[t.key] as number
          return (
            <div key={t.key} className="card animate-fadeUp p-3.5" style={{ borderTop: `2px solid ${t.color}` }}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-mut">{t.label}</div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums" style={{ color: t.color }}>{num(v)}</div>
              {t.key !== 'totalClients' && <div className="font-mono text-[10px] text-dim">{pct(v, total)}</div>}
            </div>
          )
        })}
      </div>

      {/* chart + donut */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHead title="Query volume" right={<span className="font-mono text-xs text-mut">{num(d.stats.totalQueries)} total</span>} />
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -18, right: 8, top: 6 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a3e635" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#a3e635" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fill: '#6b7585', fontSize: 10, fontFamily: 'JetBrains Mono' }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: '#212c41' }} minTickGap={48} />
                <YAxis tick={{ fill: '#6b7585', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={42} />
                <Tooltip contentStyle={{ background: '#16181d', border: '1px solid #333a47', borderRadius: 10, fontFamily: 'JetBrains Mono', fontSize: 12 }} labelStyle={{ color: '#a3acba' }} />
                <Area type="monotone" dataKey="total" name="Queries" stroke="#a3e635" strokeWidth={2} fill="url(#gTotal)" />
                <Area type="monotone" dataKey="cached" name="Cached" stroke="#a78bfa" strokeWidth={1.5} fillOpacity={0} />
                <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#fbbf24" strokeWidth={1.5} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHead title="How queries resolved" />
          <div className="space-y-3.5 p-5">
            {respData.map((r, i) => {
              const p = (100 * r.value) / respTotal
              return (
                <div key={r.name}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 font-medium text-dim">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />{r.name}
                    </span>
                    <span className="font-mono text-mut tabular-nums">{r.value.toLocaleString()} · {p.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface2">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(p, r.value > 0 ? 2 : 0)}%`, background: DONUT[i % DONUT.length] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* top lists */}
      <div className="grid gap-5 lg:grid-cols-3">
        <TopList kind="clients" title="Top clients" items={d.topClients} range={range} empty="No traffic yet" />
        <TopList kind="domains" title="Top domains" items={d.topDomains} range={range} empty="No traffic yet" />
        <TopList kind="blocked" title="Top blocked" items={d.topBlockedDomains} range={range} empty="Nothing blocked yet" />
      </div>
    </div>
  )
}

const labelFor = (kind: ListKind, it: TopItem) =>
  kind === 'clients' ? clientName(it) : { primary: it.name, secondary: '' }

// per-row quick actions, mirroring the stock dashboard kebab menus
function rowMenu(kind: ListKind, it: TopItem, nav: (p: string) => void, refresh: () => void): MenuItem[] {
  const domain = it.name
  const showLogs: MenuItem = kind === 'clients'
    ? { label: 'Show query logs', onClick: () => nav(`/logs?client=${encodeURIComponent(it.name)}`) }
    : { label: 'Show query logs', onClick: () => nav(`/logs?qname=${encodeURIComponent(domain)}`) }
  if (kind === 'clients') return [showLogs]
  const lookup: MenuItem = { label: 'Query DNS server', onClick: () => nav(`/lookup?domain=${encodeURIComponent(domain)}`) }
  const block: MenuItem = { label: 'Block domain', danger: true, onClick: async () => { try { await addBlocked(domain); toast(`Blocked ${domain}`); refresh() } catch (e: any) { toast(e?.message || 'Failed', 'err') } } }
  const allow: MenuItem = { label: 'Allow domain', onClick: async () => { try { await addAllowed(domain); toast(`Allowed ${domain}`); refresh() } catch (e: any) { toast(e?.message || 'Failed', 'err') } } }
  return kind === 'blocked' ? [showLogs, lookup, allow] : [showLogs, lookup, block]
}

function TopList({ kind, title, items, range, empty }: { kind: ListKind; title: string; items: TopItem[]; range: StatRange; empty: string }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [more, setMore] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['dashboard'] })
  const top = items.slice(0, 8)
  const max = Math.max(...items.map(i => i.hits), 1)
  return (
    <Card>
      <CardHead title={title} right={
        <div className="flex items-center gap-2">
          {kind === 'blocked' && <BlockingMenu refresh={refresh} />}
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => setMore(true)}>More</button>
        </div>} />
      {top.length === 0 ? <Empty>{empty}</Empty> :
        top.map((it, i) => { const n = labelFor(kind, it); return <RankRow key={i} primary={n.primary} secondary={n.secondary} value={it.hits} max={max} action={<Menu items={rowMenu(kind, it, nav, refresh)} />} /> })}
      {more && <MoreModal kind={kind} title={title} range={range} nav={nav} refresh={refresh} onClose={() => setMore(false)} />}
    </Card>
  )
}

function MoreModal({ kind, title, range, nav, refresh, onClose }: { kind: ListKind; title: string; range: StatRange; nav: (p: string) => void; refresh: () => void; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['topstats', kind, range], queryFn: () => getTopStats(range, STATS_TYPE[kind], 1000) })
  const max = Math.max(...(data || []).map(i => i.hits), 1)
  return (
    <Modal open onClose={onClose} wide title={data ? `${title} (top ${data.length})` : title}
      footer={<button className="btn-ghost" onClick={onClose}>Close</button>}>
      {isLoading || !data ? <Spinner /> : data.length === 0 ? <Empty>No data</Empty> :
        <div className="-mx-1">
          {data.map((it, i) => { const n = labelFor(kind, it); return <RankRow key={i} primary={n.primary} secondary={n.secondary} value={it.hits} max={max} action={<Menu items={rowMenu(kind, it, nav, refresh)} />} /> })}
        </div>}
    </Modal>
  )
}

function BlockingMenu({ refresh }: { refresh: () => void }) {
  const run = (p: Promise<any>, msg: string) => { p.then(() => { toast(msg); refresh() }).catch((e: any) => toast(e?.message || 'Failed', 'err')) }
  const items: MenuItem[] = [
    { label: 'Disable blocking 5 min', onClick: () => run(temporarilyDisableBlocking(5), 'Blocking disabled for 5 min') },
    { label: 'Disable blocking 30 min', onClick: () => run(temporarilyDisableBlocking(30), 'Blocking disabled for 30 min') },
    { label: 'Disable blocking 1 hour', onClick: () => run(temporarilyDisableBlocking(60), 'Blocking disabled for 1 hour') },
    { label: 'Re-enable blocking', onClick: () => run(setBlockingEnabled(true), 'Blocking enabled') },
    { label: 'Update block lists now', onClick: () => run(forceUpdateBlockLists(), 'Block list update started') },
  ]
  return <Menu items={items} label="Blocking" />
}
