import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Home, ChevronRight, Plus, Trash2, Folder } from 'lucide-react'
import { listAllowed, listBlocked, addAllowed, addBlocked, deleteAllowed, deleteBlocked } from '../lib/api'
import { Card, CardHead, Spinner, Empty, toast } from '../components/ui'

const KIND = {
  allowed: { list: listAllowed, add: addAllowed, del: deleteAllowed, accent: 'text-ok', word: 'allow' },
  blocked: { list: listBlocked, add: addBlocked, del: deleteBlocked, accent: 'text-warn', word: 'block' },
} as const

export default function Lists() {
  const [tab, setTab] = useState<'allowed' | 'blocked'>('blocked')
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">Allow / Block lists</h1>
      <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
        {(['blocked', 'allowed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold capitalize transition ${tab === t ? 'bg-surface3 text-accent' : 'text-dim hover:text-white'}`}>{t}</button>
        ))}
      </div>
      <Manager key={tab} kind={tab} />
    </div>
  )
}

function Manager({ kind }: { kind: 'allowed' | 'blocked' }) {
  const cfg = KIND[kind]
  const qc = useQueryClient()
  const [domain, setDomain] = useState('')
  const [add, setAdd] = useState('')
  const { data, isLoading } = useQuery({ queryKey: [kind, domain], queryFn: () => cfg.list(domain) })
  const refresh = () => qc.invalidateQueries({ queryKey: [kind] })
  const crumbs = domain ? domain.split('.').map((_, i, a) => a.slice(i).join('.')).reverse() : []

  const doAdd = async () => {
    const d = add.trim().replace(/\.$/, ''); if (!d) return
    try { await cfg.add(d); toast(`Now ${cfg.word}ing ${d}`); setAdd(''); refresh() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }
  const doDel = async (d: string) => {
    if (!confirm(`Stop ${cfg.word}ing ${d}?`)) return
    try { await cfg.del(d); toast(`Removed ${d}`); if (d === domain) setDomain(crumbs[crumbs.length - 2] || ''); refresh() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <Plus size={16} className="ml-1.5 text-mut" />
          <input className="input flex-1" placeholder={`domain to ${cfg.word} (e.g. ads.example.com)`} value={add}
            onChange={e => setAdd(e.target.value)} onKeyDown={e => e.key === 'Enter' && doAdd()} />
          <button className="btn-primary" onClick={doAdd}>{cfg.word === 'block' ? 'Block' : 'Allow'}</button>
        </div>
      </Card>

      <div className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <button onClick={() => setDomain('')} className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 ${!domain ? 'text-accent' : 'text-dim hover:text-white'}`}><Home size={13} /> root</button>
        {crumbs.map(c => (
          <span key={c} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-mut" />
            <button onClick={() => setDomain(c)} className={`rounded-md px-1.5 py-0.5 font-mono text-[13px] ${c === domain ? 'text-accent' : 'text-dim hover:text-white'}`}>{c.split('.')[0]}</button>
          </span>
        ))}
      </div>

      <Card>
        <CardHead title={domain ? domain : `${kind} entries`}
          right={domain ? <button onClick={() => doDel(domain)} className="btn-ghost text-xs !text-bad hover:!bg-bad/10"><Trash2 size={13} /> Remove</button> : undefined} />
        {isLoading ? <Spinner /> : !data || data.zones.length === 0 ?
          <Empty>{domain ? 'This is a leaf entry — use Remove above.' : `No ${kind} domains yet. Add one above.`}</Empty> :
          <div className="p-1.5">
            {data.zones.map(z => (
              <div key={z} className="group flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-white/5">
                <button onClick={() => setDomain(z)} className="flex min-w-0 items-center gap-2 font-mono text-[13px] text-dim hover:text-white">
                  <Folder size={13} className="text-mut" /><span className="truncate">{z}</span>
                </button>
                <button onClick={() => doDel(z)} title="Remove" className="rounded-md p-1.5 text-mut opacity-0 transition hover:bg-bad/15 hover:text-bad group-hover:opacity-100"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>}
      </Card>
    </div>
  )
}
