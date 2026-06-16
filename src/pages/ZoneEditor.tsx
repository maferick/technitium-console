import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Pencil, SlidersHorizontal, ShieldCheck } from 'lucide-react'
import { getRecords, addRecord, deleteRecord, deleteZone, RTYPES, ZoneRecord } from '../lib/api'
import { qtypeCls } from '../lib/format'
import { Card, CardHead, Chip, Spinner, Empty, Modal, Field, toast } from '../components/ui'
import ZoneOptionsModal from '../components/ZoneOptionsModal'
import DnssecModal from '../components/DnssecModal'

function rdataStr(d: any): string {
  if (!d) return ''
  if (d.ipAddress) return d.ipAddress
  if (d.nameServer) return d.nameServer
  if (d.cname) return d.cname
  if (d.ptrName) return d.ptrName
  if (d.exchange) return `${d.preference ?? ''} ${d.exchange}`.trim()
  if (d.text) return Array.isArray(d.text) ? d.text.join(' ') : d.text
  if (d.target) return `${d.priority ?? ''} ${d.weight ?? ''} ${d.port ?? ''} ${d.target}`.trim()
  if (d.primaryNameServer) return `${d.primaryNameServer} · serial ${d.serial}`
  if (d.tag) return `${d.flags} ${d.tag} "${d.value}"`
  return JSON.stringify(d).replace(/[{}"]/g, '').slice(0, 80)
}
const EDITABLE = Object.keys(RTYPES)
const fieldsOf = (type: string, rData: any) => Object.fromEntries((RTYPES[type] || []).map(f => [f.k, String(rData[f.k] ?? '')]))

export default function ZoneEditor() {
  const { zone = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['records', zone], queryFn: () => getRecords(zone) })
  const [edit, setEdit] = useState<ZoneRecord | null>(null)
  const [adding, setAdding] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showDnssec, setShowDnssec] = useState(false)
  const signed = !!data?.some(r => r.type === 'DNSKEY')

  const refresh = () => qc.invalidateQueries({ queryKey: ['records', zone] })
  const del = async (r: ZoneRecord) => {
    if (!confirm(`Delete ${r.type} record for ${r.name || '@'}?`)) return
    try { await deleteRecord(zone, r.name || zone, r.type, fieldsOf(r.type, r.rData)); toast('Record deleted'); refresh() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }
  const dropZone = async () => {
    if (!confirm(`Delete the entire zone "${zone}"? This cannot be undone.`)) return
    try { await deleteZone(zone); toast(`Zone ${zone} deleted`); nav('/zones') }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/zones" className="btn-ghost !px-2.5 !py-1.5"><ArrowLeft size={15} /></Link>
          <h1 className="font-mono text-xl font-extrabold tracking-tight">{zone || '.'}</h1>
          {signed && <Chip className="text-ok bg-ok/10">DNSSEC</Chip>}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => { setEdit(null); setAdding(true) }}><Plus size={15} /> Add record</button>
          <button className="btn-ghost" onClick={() => setShowOptions(true)}><SlidersHorizontal size={15} /> Options</button>
          <button className="btn-ghost" onClick={() => setShowDnssec(true)}><ShieldCheck size={15} /> DNSSEC</button>
          <button className="btn-ghost !text-bad hover:!bg-bad/10" onClick={dropZone}><Trash2 size={15} /> Delete zone</button>
        </div>
      </div>

      <Card>
        <CardHead title={`Records · ${data?.length || 0}`} />
        {isLoading ? <Spinner /> : !data || data.length === 0 ? <Empty>No records.</Empty> :
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
                <th className="px-5 py-3">Name</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">TTL</th><th className="px-5 py-3">Value</th><th className="px-5 py-3"></th>
              </tr></thead>
              <tbody>
                {data.map((r, i) => {
                  const editable = EDITABLE.includes(r.type) && r.type !== 'SOA'
                  return (
                    <tr key={i} className="group border-t border-line hover:bg-surface2">
                      <td className="px-5 py-2.5 font-mono text-[13px] text-txt">{r.name === zone ? '@' : r.name.replace('.' + zone, '')}</td>
                      <td className="px-5 py-2.5"><Chip className={qtypeCls(r.type)}>{r.type}</Chip></td>
                      <td className="px-5 py-2.5 font-mono text-xs text-mut">{r.ttl}s</td>
                      <td className="max-w-[440px] truncate px-5 py-2.5 font-mono text-[13px] text-accent" title={rdataStr(r.rData)}>{rdataStr(r.rData)}</td>
                      <td className="px-5 py-2.5 text-right">
                        {editable && <div className="inline-flex gap-1 opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => { setEdit(r); setAdding(true) }} title="Edit" className="rounded-md p-1.5 text-mut hover:bg-white/10 hover:text-white"><Pencil size={14} /></button>
                          <button onClick={() => del(r)} title="Delete" className="rounded-md p-1.5 text-mut hover:bg-bad/15 hover:text-bad"><Trash2 size={14} /></button>
                        </div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
      </Card>

      {adding && <RecordModal zone={zone} edit={edit} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh() }} />}
      {showOptions && <ZoneOptionsModal zone={zone} onClose={() => setShowOptions(false)} onDone={() => { setShowOptions(false); refresh() }} />}
      {showDnssec && <DnssecModal zone={zone} onClose={() => setShowDnssec(false)} onDone={refresh} />}
    </div>
  )
}

function RecordModal({ zone, edit, onClose, onDone }: { zone: string; edit: ZoneRecord | null; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState(edit?.type && RTYPES[edit.type] ? edit.type : 'A')
  const [name, setName] = useState(edit ? (edit.name === zone ? '@' : edit.name.replace('.' + zone, '')) : '@')
  const [ttl, setTtl] = useState(String(edit?.ttl || 3600))
  const [vals, setVals] = useState<Record<string, string>>(edit ? fieldsOf(edit.type, edit.rData) : {})
  const [busy, setBusy] = useState(false)
  const fields = RTYPES[type] || []

  const submit = async () => {
    const domain = name === '@' || name === '' ? zone : (name.endsWith(zone) ? name : `${name}.${zone}`)
    setBusy(true)
    try {
      if (edit) await deleteRecord(zone, edit.name || zone, edit.type, fieldsOf(edit.type, edit.rData))
      await addRecord(zone, domain, type, Number(ttl) || 3600, vals)
      toast(edit ? 'Record updated' : 'Record added'); onDone()
    } catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={edit ? 'Edit record' : 'Add record'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : edit ? 'Save' : 'Add record'}</button></>}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Name"><input className="input w-full" value={name} onChange={e => setName(e.target.value)} placeholder="@ or subdomain" /></Field>
          <Field label="Type"><select className="input w-full" disabled={!!edit} value={type} onChange={e => { setType(e.target.value); setVals({}) }}>{EDITABLE.map(t => <option key={t}>{t}</option>)}</select></Field>
        </div>
        {fields.map(f => (
          <Field key={f.k} label={f.label}><input className="input w-full" type={f.type || 'text'} value={vals[f.k] || ''} onChange={e => setVals(v => ({ ...v, [f.k]: e.target.value }))} /></Field>
        ))}
        <Field label="TTL (seconds)"><input className="input w-full" type="number" value={ttl} onChange={e => setTtl(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
