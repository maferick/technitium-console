import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronRight } from 'lucide-react'
import { getZones, createZone } from '../lib/api'
import { Card, CardHead, Chip, Spinner, Empty, Modal, Field, toast } from '../components/ui'

const typeCls = (t: string) =>
  t === 'Primary' ? 'text-accent bg-accent/10' :
  t === 'Secondary' ? 'text-violet bg-violet/10' :
  t === 'Forwarder' ? 'text-teal bg-teal/10' :
  t === 'Catalog' ? 'text-warn bg-warn/10' : 'text-dim bg-white/5'
const ZONE_TYPES = ['Primary', 'Forwarder', 'Secondary', 'Stub']

export default function Zones() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['zones'], queryFn: getZones })
  const [adding, setAdding] = useState(false)
  const zones = (data || []).slice().sort((a, b) => Number(a.internal) - Number(b.internal) || a.name.localeCompare(b.name))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Zones</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> New zone</button>
      </div>
      <Card>
        <CardHead title={`${data?.length || 0} zones`} />
        {isLoading ? <Spinner /> : zones.length === 0 ? <Empty>No zones.</Empty> :
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
                <th className="px-5 py-3">Zone</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">DNSSEC</th><th className="px-5 py-3">Scope</th><th className="px-5 py-3"></th>
              </tr></thead>
              <tbody>
                {zones.map((z, i) => (
                  <tr key={i} onClick={() => nav(`/zones/${encodeURIComponent(z.name)}`)}
                    className={`group cursor-pointer border-t border-line hover:bg-surface2 ${z.disabled ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-2.5 font-mono text-[13px] text-txt">{z.name || '.'}</td>
                    <td className="px-5 py-2.5"><Chip className={typeCls(z.type)}>{z.type}</Chip></td>
                    <td className="px-5 py-2.5"><Chip className={z.dnssecStatus !== 'Unsigned' ? 'text-ok bg-ok/10' : 'text-mut bg-white/5'}>{z.dnssecStatus}</Chip></td>
                    <td className="px-5 py-2.5"><Chip className={z.internal ? 'text-mut bg-white/5' : 'text-cyan bg-cyan/10'}>{z.internal ? 'internal' : 'user'}</Chip></td>
                    <td className="px-5 py-2.5 text-right"><ChevronRight size={15} className="ml-auto text-mut opacity-0 transition group-hover:opacity-100" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </Card>
      {adding && <NewZone onClose={() => setAdding(false)} onDone={(name) => { setAdding(false); qc.invalidateQueries({ queryKey: ['zones'] }); nav(`/zones/${encodeURIComponent(name)}`) }} />}
    </div>
  )
}

function NewZone({ onClose, onDone }: { onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('Primary')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const z = name.trim().replace(/\.$/, ''); if (!z) return
    setBusy(true)
    try { await createZone(z, type); toast(`Zone ${z} created`); onDone(z) }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="New zone"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create'}</button></>}>
      <div className="space-y-3.5">
        <Field label="Zone name"><input className="input w-full" autoFocus placeholder="example.com" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Type"><select className="input w-full" value={type} onChange={e => setType(e.target.value)}>{ZONE_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
      </div>
    </Modal>
  )
}
