import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Folder, Trash2, Home, Search } from 'lucide-react'
import { getCache, deleteCache, flushCache, CacheRecord } from '../lib/api'
import { qtypeCls } from '../lib/format'
import { Card, CardHead, Chip, Spinner, Empty, toast } from '../components/ui'

// cache rData is camelCase
function rdata(type: string, d: any): string {
  if (!d) return ''
  if (d.ipAddress) return d.ipAddress
  if (d.nameServer) return d.nameServer
  if (d.cname) return d.cname
  if (d.domain) return d.domain
  if (d.ptrName) return d.ptrName
  if (d.exchange) return `${d.preference ?? ''} ${d.exchange}`.trim()
  if (d.text) return Array.isArray(d.text) ? d.text.join(' ') : d.text
  if (d.target) return `${d.priority ?? ''} ${d.weight ?? ''} ${d.port ?? ''} ${d.target}`.trim()
  if (d.primaryNameServer) return `${d.primaryNameServer} (${d.responsiblePerson || ''})`
  if (d.keyTag !== undefined) return `keyTag ${d.keyTag} · ${d.algorithm || d.algorithmNumber}`
  if (d.flags !== undefined && d.tag) return `${d.tag} "${d.value}"`
  return JSON.stringify(d).replace(/[{}"]/g, '').slice(0, 90)
}
const ttlShort = (t: string) => (t || '').replace(/^\d+\s*\(/, '').replace(/\)$/, '') || t

export default function CachePage() {
  const [domain, setDomain] = useState('')
  const [jump, setJump] = useState('')
  const [zf, setZf] = useState('')
  const qc = useQueryClient()
  const { data, isLoading, isFetching } = useQuery({ queryKey: ['cache', domain], queryFn: () => getCache(domain) })

  const crumbs = domain ? domain.split('.').map((_, i, a) => a.slice(i).join('.')).reverse() : []
  const zones = (data?.zones || []).filter(z => !zf || z.toLowerCase().includes(zf.toLowerCase()))

  const del = async (target: string, label: string) => {
    try { await deleteCache(target); toast(`Removed ${label || 'root'} from cache`); qc.invalidateQueries({ queryKey: ['cache'] }) }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }
  const flush = async () => {
    if (!confirm('Flush the ENTIRE DNS cache on this server?')) return
    try { await flushCache(); toast('Cache flushed'); setDomain(''); qc.invalidateQueries({ queryKey: ['cache'] }) }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Cache</h1>
        <button onClick={flush} className="btn-ghost text-xs !text-bad hover:!bg-bad/10"><Trash2 size={14} /> Flush all</button>
      </div>

      {/* breadcrumb + jump */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <button onClick={() => setDomain('')} className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 ${!domain ? 'text-accent' : 'text-dim hover:text-white'}`}><Home size={13} /> root</button>
          {crumbs.map(c => (
            <span key={c} className="flex items-center gap-1">
              <ChevronRight size={13} className="text-mut" />
              <button onClick={() => setDomain(c)} className={`rounded-md px-1.5 py-0.5 font-mono text-[13px] ${c === domain ? 'text-accent' : 'text-dim hover:text-white'}`}>{c.split('.')[0]}</button>
            </span>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); setDomain(jump.trim().replace(/\.$/, '')); }} className="flex items-center gap-2">
          <input className="input w-56" placeholder="jump to domain…" value={jump} onChange={e => setJump(e.target.value)} />
          <button className="btn-ghost !px-2.5"><Search size={15} /></button>
        </form>
        {isFetching && <span className="font-mono text-xs text-mut">refreshing…</span>}
      </div>

      {isLoading ? <Spinner /> :
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* child zones */}
          <Card className="self-start">
            <CardHead title={`Subdomains · ${data?.zones.length || 0}`}
              right={data && data.zones.length > 8 ? <input className="input !py-1 w-28 text-xs" placeholder="filter…" value={zf} onChange={e => setZf(e.target.value)} /> : undefined} />
            {zones.length === 0 ? <Empty>No subdomains</Empty> :
              <div className="max-h-[60vh] overflow-y-auto p-1.5">
                {zones.map(z => (
                  <button key={z} onClick={() => { setDomain(z); setZf('') }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-mono text-[13px] text-dim transition hover:bg-white/5 hover:text-white">
                    <Folder size={13} className="text-mut" /><span className="truncate">{z.replace(domain ? '.' + domain : '', '') || z}</span>
                  </button>
                ))}
              </div>}
          </Card>

          {/* records */}
          <Card>
            <CardHead title={domain ? `Records · ${domain}` : 'Records · root'}
              right={domain ? <button onClick={() => del(domain, domain)} className="btn-ghost text-xs !text-bad hover:!bg-bad/10"><Trash2 size={13} /> Remove</button> : undefined} />
            {!data || data.records.length === 0 ? <Empty>No cached records at this name.</Empty> :
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
                    <th className="px-5 py-3">Type</th><th className="px-5 py-3">Value</th><th className="px-5 py-3">TTL</th><th className="px-5 py-3">DNSSEC</th>
                  </tr></thead>
                  <tbody>
                    {data.records.map((r: CacheRecord, i: number) => (
                      <tr key={i} className="border-t border-line hover:bg-surface2">
                        <td className="px-5 py-2.5"><Chip className={qtypeCls(r.type)}>{r.type}</Chip></td>
                        <td className="max-w-[520px] truncate px-5 py-2.5 font-mono text-[13px] text-accent" title={rdata(r.type, r.rData)}>{rdata(r.type, r.rData)}</td>
                        <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-mut">{ttlShort(r.ttl)}</td>
                        <td className="px-5 py-2.5"><Chip className={r.dnssecStatus === 'Secure' ? 'text-ok bg-ok/10' : r.dnssecStatus === 'Insecure' ? 'text-mut bg-white/5' : 'text-dim bg-white/5'}>{r.dnssecStatus || '—'}</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
          </Card>
        </div>}
    </div>
  )
}
