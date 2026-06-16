import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search, RotateCw, Ban, Check } from 'lucide-react'
import { getQueryLogs, QueryLogFilter, addBlocked, addAllowed } from '../lib/api'
import { relTime, timeAbs, respMeta, rcodeMeta, qtypeCls } from '../lib/format'
import { Card, Chip, Spinner, Empty, toast } from '../components/ui'

const RESP_OPTS = ['', 'Recursive', 'Cached', 'Authoritative', 'Blocked', 'Dropped']
const TYPE_OPTS = ['', 'A', 'AAAA', 'HTTPS', 'PTR', 'TXT', 'MX', 'SRV', 'NS', 'CNAME']

export default function QueryLog() {
  const [sp] = useSearchParams()
  // deep-link filters from the dashboard quick actions (?client= / ?qname=)
  const initial: QueryLogFilter = { clientIpAddress: sp.get('client') || undefined, qname: sp.get('qname') || undefined }
  const [f, setF] = useState<QueryLogFilter>(initial)
  const [draft, setDraft] = useState<QueryLogFilter>(initial)
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['qlog', f, page],
    queryFn: () => getQueryLogs({ ...f, pageNumber: page, entriesPerPage: 25 }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  })

  const apply = () => { setF(draft); setPage(1) }
  const reset = () => { setDraft({}); setF({}); setPage(1) }
  const set = (k: keyof QueryLogFilter, v: string) => setDraft(d => ({ ...d, [k]: v || undefined }))
  const act = async (kind: 'block' | 'allow', domain: string) => {
    if (!domain) return
    try { await (kind === 'block' ? addBlocked(domain) : addAllowed(domain)); toast(`${kind === 'block' ? 'Blocked' : 'Allowed'} ${domain}`) }
    catch (e: any) { toast(e?.message || 'Action failed', 'err') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Query Log</h1>
        <span className="font-mono text-xs text-mut">{data ? `${data.totalEntries.toLocaleString()} queries logged` : ''}</span>
      </div>

      {/* filters */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Client IP"><input className="input w-40" placeholder="192.168.1.50" value={draft.clientIpAddress || ''} onChange={e => set('clientIpAddress', e.target.value)} onKeyDown={e => e.key === 'Enter' && apply()} /></Field>
          <Field label="Domain"><input className="input w-56" placeholder="contains…" value={draft.qname || ''} onChange={e => set('qname', e.target.value)} onKeyDown={e => e.key === 'Enter' && apply()} /></Field>
          <Field label="Result"><select className="input w-36" value={draft.responseType || ''} onChange={e => set('responseType', e.target.value)}>{RESP_OPTS.map(o => <option key={o} value={o}>{o ? respMeta(o).label : 'Any'}</option>)}</select></Field>
          <Field label="Type"><select className="input w-28" value={draft.qtype || ''} onChange={e => set('qtype', e.target.value)}>{TYPE_OPTS.map(o => <option key={o} value={o}>{o || 'Any'}</option>)}</select></Field>
          <button className="btn-primary" onClick={apply}><Search size={15} /> Search</button>
          <button className="btn-ghost" onClick={reset}>Clear</button>
          <button className="btn-ghost ml-auto !px-2.5" onClick={() => refetch()} title="Refresh"><RotateCw size={15} className={isFetching ? 'animate-spin' : ''} /></button>
        </div>
      </Card>

      <Card>
        {isLoading ? <Spinner label="Loading queries…" /> :
         !data || data.entries.length === 0 ? <Empty>No matching queries.</Empty> :
         <div className="overflow-x-auto">
           <table className="w-full">
             <thead>
               <tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
                 <th className="px-5 py-3">Time</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Domain</th>
                 <th className="px-5 py-3">Type</th><th className="px-5 py-3">Result</th><th className="px-5 py-3"></th>
               </tr>
             </thead>
             <tbody>
               {data.entries.map(e => {
                 const r = rcodeMeta(e.rcode), rt = respMeta(e.responseType)
                 return (
                   <tr key={e.rowNumber} className="group border-t border-line transition hover:bg-surface2">
                     <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-dim" title={timeAbs(e.timestamp)}>{relTime(e.timestamp)}</td>
                     <td className="whitespace-nowrap px-5 py-2.5 font-mono text-[13px]">{e.clientIpAddress}</td>
                     <td className="max-w-[420px] truncate px-5 py-2.5 font-mono text-[13px] text-txt" title={e.qname}>{e.qname || '—'}</td>
                     <td className="px-5 py-2.5"><Chip className={qtypeCls(e.qtype)}>{e.qtype}</Chip></td>
                     <td className="whitespace-nowrap px-5 py-2.5">
                       <Chip className={r.cls}>{r.label}</Chip>
                       <Chip className={`ml-1.5 ${rt.cls}`}>{rt.label}</Chip>
                     </td>
                     <td className="whitespace-nowrap px-5 py-2.5 text-right">
                       <div className="inline-flex gap-1 opacity-0 transition group-hover:opacity-100">
                         <button title={`Block ${e.qname}`} onClick={() => act('block', e.qname)} className="rounded-md p-1.5 text-mut hover:bg-warn/15 hover:text-warn"><Ban size={14} /></button>
                         <button title={`Allow ${e.qname}`} onClick={() => act('allow', e.qname)} className="rounded-md p-1.5 text-mut hover:bg-ok/15 hover:text-ok"><Check size={14} /></button>
                       </div>
                     </td>
                   </tr>
                 )
               })}
             </tbody>
           </table>
         </div>}

        {data && data.totalPages > 1 &&
          <div className="flex items-center justify-between border-t border-line px-5 py-3 font-mono text-xs text-mut">
            <span>Page {data.pageNumber.toLocaleString()} of {data.totalPages.toLocaleString()}</span>
            <div className="flex gap-2">
              <button className="btn-ghost !px-2.5 !py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15} /> Prev</button>
              <button className="btn-ghost !px-2.5 !py-1.5 disabled:opacity-40" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15} /></button>
            </div>
          </div>}
      </Card>
    </div>
  )
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) =>
  <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-mut">{label}</div>{children}</div>
