import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ShieldCheck } from 'lucide-react'
import { resolve, ResolveResult } from '../lib/api'
import { Card, CardHead, Chip, Empty } from '../components/ui'
import { qtypeCls } from '../lib/format'

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SRV', 'SOA', 'CAA', 'HTTPS', 'ANY']

function rdata(r: any): string {
  const d = r.RDATA || {}
  if (d.IPAddress) return d.IPAddress
  if (d.Domain) return d.Domain
  if (d.NameServer) return d.NameServer
  if (d.Exchange) return `${d.Preference ?? ''} ${d.Exchange}`.trim()
  if (d.Text) return Array.isArray(d.Text) ? d.Text.join(' ') : d.Text
  if (d.Target) return `${d.Priority ?? ''} ${d.Weight ?? ''} ${d.Port ?? ''} ${d.Target}`.trim()
  return JSON.stringify(d)
}

export default function Lookup() {
  const [sp] = useSearchParams()
  const [domain, setDomain] = useState(sp.get('domain') || '')
  const [type, setType] = useState('A')
  const [dnssec, setDnssec] = useState(false)
  const [res, setRes] = useState<ResolveResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function runLookup(dom: string, t = type, ds = dnssec) {
    if (!dom) return
    setBusy(true); setErr(''); setRes(null)
    try { setRes(await resolve(dom.trim(), t, { dnssec: ds })) }
    catch (e: any) { setErr(e?.message || 'Lookup failed') }
    finally { setBusy(false) }
  }
  const go = (e: FormEvent) => { e.preventDefault(); runLookup(domain) }

  // auto-resolve when arriving via a dashboard "Query DNS server" deep link
  useEffect(() => { const d = sp.get('domain'); if (d) runLookup(d) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const answers = res?.Answer || []

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">DNS Lookup</h1>
      <Card className="p-4">
        <form onSubmit={go} className="flex flex-wrap items-end gap-2">
          <div className="grow">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-mut">Domain</div>
            <input className="input w-full" placeholder="example.com" value={domain} onChange={e => setDomain(e.target.value)} autoFocus />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-mut">Type</div>
            <select className="input w-28" value={type} onChange={e => setType(e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <button type="button" onClick={() => setDnssec(v => !v)}
            className={`btn ${dnssec ? 'bg-accent/15 text-accent' : 'btn-ghost'}`}><ShieldCheck size={15} /> DNSSEC</button>
          <button className="btn-primary" disabled={busy}><Search size={15} /> {busy ? 'Resolving…' : 'Resolve'}</button>
        </form>
      </Card>

      {err && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{err}</div>}

      {res && (
        <Card>
          <CardHead title={`Answer · ${res.Question.Name} ${res.Question.Type}`} right={
            answers[0]?.DnssecStatus && answers[0].DnssecStatus !== 'Disabled'
              ? <Chip className="text-ok bg-ok/10">DNSSEC {answers[0].DnssecStatus}</Chip> : undefined} />
          {answers.length === 0 ? <Empty>No records returned.</Empty> :
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
                  <th className="px-5 py-3">Name</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">TTL</th><th className="px-5 py-3">Value</th>
                </tr></thead>
                <tbody>
                  {answers.map((a, i) => (
                    <tr key={i} className="border-t border-line hover:bg-surface2">
                      <td className="px-5 py-2.5 font-mono text-[13px] text-dim">{a.Name}</td>
                      <td className="px-5 py-2.5"><Chip className={qtypeCls(a.Type)}>{a.Type}</Chip></td>
                      <td className="px-5 py-2.5 font-mono text-xs text-mut">{a.TTL}</td>
                      <td className="px-5 py-2.5 font-mono text-[13px] text-accent">{rdata(a)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </Card>
      )}
    </div>
  )
}
