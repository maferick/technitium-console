import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, RefreshCw, ArrowUpCircle, StopCircle, Eye, ShieldOff } from 'lucide-react'
import {
  getDnssecProperties, getDS, signZone, unsignZone, addDnssecPrivateKey, updateDnssecPrivateKey,
  deleteDnssecPrivateKey, publishAllDnssecKeys, rolloverDnssecKey, retireDnssecKey,
  convertToNSEC, convertToNSEC3, updateNSEC3Params, updateDnsKeyTtl, DnssecKey, DsRecordInfo,
} from '../lib/api'
import { Modal, Field, Spinner, Chip, toast } from './ui'

const ALGORITHMS = ['ECDSA', 'RSA', 'EDDSA']
const CURVES: Record<string, string[]> = { ECDSA: ['P256', 'P384'], EDDSA: ['ED25519', 'ED448'] }
const RSA_HASH = ['SHA256', 'SHA512', 'SHA1', 'MD5']

const stateCls = (s: string, retiring: boolean) =>
  retiring ? 'text-warn bg-warn/10' :
  s === 'Active' ? 'text-ok bg-ok/10' :
  s === 'Ready' ? 'text-accent bg-accent/10' :
  s === 'Published' ? 'text-violet bg-violet/10' :
  'text-mut bg-white/5'

const Title = ({ children }: { children: React.ReactNode }) =>
  <div className="text-[11px] font-bold uppercase tracking-wider text-accent">{children}</div>

// Algorithm/curve/keysize picker shared by Sign and Add-key forms.
function AlgoFields({ v, set }: { v: any; set: (k: string, val: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Algorithm"><select className="input w-full" value={v.algorithm} onChange={e => set('algorithm', e.target.value)}>{ALGORITHMS.map(a => <option key={a}>{a}</option>)}</select></Field>
        {v.algorithm === 'RSA'
          ? <Field label="Hash"><select className="input w-full" value={v.hashAlgorithm} onChange={e => set('hashAlgorithm', e.target.value)}>{RSA_HASH.map(h => <option key={h}>{h}</option>)}</select></Field>
          : <Field label="Curve"><select className="input w-full" value={v.curve} onChange={e => set('curve', e.target.value)}>{(CURVES[v.algorithm] || []).map(c => <option key={c}>{c}</option>)}</select></Field>}
      </div>
      {v.algorithm === 'RSA' && <Field label="Key size (bits)"><input className="input w-full" type="number" value={v.keySize} onChange={e => set('keySize', +e.target.value)} /></Field>}
    </>
  )
}

export default function DnssecModal({ zone, onClose, onDone }: { zone: string; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['dnssec', zone], queryFn: () => getDnssecProperties(zone) })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['dnssec', zone] }); onDone() }
  return (
    <Modal open onClose={onClose} wide title={`DNSSEC - ${zone}`} footer={null as any}>
      {isLoading || !data ? <Spinner label="Loading DNSSEC..." /> :
        data.dnssecStatus === 'Unsigned'
          ? <SignForm zone={zone} onClose={onClose} onSigned={refresh} />
          : <Manage zone={zone} status={data.dnssecStatus} dnsKeyTtl={data.dnsKeyTtl} keys={data.dnssecPrivateKeys} onClose={onClose} refresh={refresh} />}
    </Modal>
  )
}

function SignForm({ zone, onClose, onSigned }: { zone: string; onClose: () => void; onSigned: () => void }) {
  const [v, setV] = useState<any>({ algorithm: 'ECDSA', curve: 'P256', hashAlgorithm: 'SHA256', keySize: 2048, dnsKeyTtl: 86400, zskRolloverDays: 30, nxProof: 'NSEC', iterations: 0, saltLength: 0 })
  const [busy, setBusy] = useState(false)
  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }))
  const sign = async () => {
    setBusy(true)
    const o: Record<string, any> = { algorithm: v.algorithm, dnsKeyTtl: v.dnsKeyTtl, zskRolloverDays: v.zskRolloverDays, nxProof: v.nxProof }
    if (v.algorithm === 'RSA') { o.hashAlgorithm = v.hashAlgorithm; o.kskKeySize = v.keySize; o.zskKeySize = v.keySize }
    else o.curve = v.curve
    if (v.nxProof === 'NSEC3') { o.iterations = v.iterations; o.saltLength = v.saltLength }
    try { await signZone(zone, o); toast(`Zone ${zone} signed`); onSigned() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-dim">Sign this primary zone with DNSSEC. A Key Signing Key (KSK) and Zone Signing Key (ZSK) will be generated automatically.</p>
        <AlgoFields v={v} set={set} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="DNSKEY TTL (s)"><input className="input w-full" type="number" value={v.dnsKeyTtl} onChange={e => set('dnsKeyTtl', +e.target.value)} /></Field>
          <Field label="ZSK rollover (days, 0 = off)"><input className="input w-full" type="number" value={v.zskRolloverDays} onChange={e => set('zskRolloverDays', +e.target.value)} /></Field>
        </div>
        <Field label="Proof of non-existence">
          <select className="input w-full" value={v.nxProof} onChange={e => set('nxProof', e.target.value)}><option>NSEC</option><option>NSEC3</option></select>
        </Field>
        {v.nxProof === 'NSEC3' && <div className="grid grid-cols-2 gap-3">
          <Field label="NSEC3 iterations"><input className="input w-full" type="number" value={v.iterations} onChange={e => set('iterations', +e.target.value)} /></Field>
          <Field label="NSEC3 salt length"><input className="input w-full" type="number" value={v.saltLength} onChange={e => set('saltLength', +e.target.value)} /></Field>
        </div>}
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={busy} onClick={sign}>{busy ? 'Signing...' : 'Sign zone'}</button>
      </div>
    </>
  )
}

function Manage({ zone, status, dnsKeyTtl, keys, onClose, refresh }:
  { zone: string; status: string; dnsKeyTtl: number; keys: DnssecKey[]; onClose: () => void; refresh: () => void }) {
  const [adding, setAdding] = useState(false)
  const [ttl, setTtl] = useState(dnsKeyTtl)
  const [iterations, setIterations] = useState(0)
  const [saltLength, setSaltLength] = useState(0)
  const [ds, setDs] = useState<DsRecordInfo[] | null>(null)
  const isNsec3 = status === 'SignedWithNSEC3'
  const hasGenerated = keys.some(k => k.state === 'Generated')

  const run = async (p: Promise<any>, msg: string) => { try { await p; toast(msg); refresh() } catch (e: any) { toast(e?.message || 'Failed', 'err') } }
  const viewDs = async () => { try { setDs((await getDS(zone)).dsRecords) } catch (e: any) { toast(e?.message || 'Failed', 'err') } }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Chip className="text-ok bg-ok/10">{status === 'SignedWithNSEC3' ? 'Signed (NSEC3)' : 'Signed (NSEC)'}</Chip>
          <span className="text-xs text-mut">{keys.length} key(s)</span>
        </div>

        {/* keys table */}
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full">
            <thead><tr className="bg-surface2/50 text-left text-[10px] font-bold uppercase tracking-wider text-mut">
              <th className="px-3 py-2">Tag</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Algorithm</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Rollover</th><th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.keyTag} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-[13px] text-txt">{k.keyTag}</td>
                  <td className="px-3 py-2 text-[12px] text-dim">{k.keyType === 'KeySigningKey' ? 'KSK' : 'ZSK'}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-mut">{k.algorithm}</td>
                  <td className="px-3 py-2"><Chip className={stateCls(k.state, k.isRetiring)}>{k.isRetiring ? 'Retiring' : k.state}</Chip></td>
                  <td className="px-3 py-2">
                    <input className="input !w-16 !py-1 !text-[12px]" type="number" defaultValue={k.rolloverDays}
                      onBlur={e => { const d = +e.target.value; if (d !== k.rolloverDays) run(updateDnssecPrivateKey(zone, k.keyTag, d), 'Rollover updated') }} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {!k.isRetiring && (k.state === 'Active' || k.state === 'Ready' || k.state === 'Published') &&
                        <button title="Rollover now" onClick={() => run(rolloverDnssecKey(zone, k.keyTag), 'Rollover started')} className="rounded-md p-1.5 text-mut hover:bg-white/10 hover:text-white"><RefreshCw size={13} /></button>}
                      {!k.isRetiring && k.state === 'Active' &&
                        <button title="Retire key" onClick={() => confirm(`Retire key ${k.keyTag}? There must be another active key.`) && run(retireDnssecKey(zone, k.keyTag), 'Key retiring')} className="rounded-md p-1.5 text-mut hover:bg-warn/15 hover:text-warn"><StopCircle size={13} /></button>}
                      {k.state === 'Generated' &&
                        <button title="Delete unpublished key" onClick={() => run(deleteDnssecPrivateKey(zone, k.keyTag), 'Key deleted')} className="rounded-md p-1.5 text-mut hover:bg-bad/15 hover:text-bad"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => setAdding(true)}><Plus size={14} /> Add key</button>
          {hasGenerated && <button className="btn-ghost !py-1.5 text-xs" onClick={() => run(publishAllDnssecKeys(zone), 'Keys published')}><ArrowUpCircle size={14} /> Publish all</button>}
          <button className="btn-ghost !py-1.5 text-xs" onClick={viewDs}><Eye size={14} /> View DS records</button>
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => run(isNsec3 ? convertToNSEC(zone) : convertToNSEC3(zone), isNsec3 ? 'Converted to NSEC' : 'Converted to NSEC3')}>
            Convert to {isNsec3 ? 'NSEC' : 'NSEC3'}
          </button>
        </div>

        {/* DNSKEY TTL + NSEC3 params */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Title>DNSKEY TTL</Title>
            <div className="mt-2 flex gap-2">
              <input className="input w-full" type="number" value={ttl} onChange={e => setTtl(+e.target.value)} />
              <button className="btn-ghost text-xs" onClick={() => run(updateDnsKeyTtl(zone, ttl), 'DNSKEY TTL updated')}>Set</button>
            </div>
          </div>
          {isNsec3 && <div>
            <Title>NSEC3 parameters</Title>
            <div className="mt-2 flex gap-2">
              <input className="input w-full" type="number" placeholder="iterations" value={iterations} onChange={e => setIterations(+e.target.value)} />
              <input className="input w-full" type="number" placeholder="salt len" value={saltLength} onChange={e => setSaltLength(+e.target.value)} />
              <button className="btn-ghost text-xs" onClick={() => run(updateNSEC3Params(zone, iterations, saltLength), 'NSEC3 params updated')}>Set</button>
            </div>
          </div>}
        </div>

        {ds && <div>
          <Title>DS records (publish these at the parent zone)</Title>
          <div className="mt-2 space-y-2">
            {ds.length === 0 ? <div className="text-sm text-mut">No DS records.</div> : ds.map((d, i) => (
              <div key={i} className="rounded-lg border border-line bg-surface2/40 p-3 font-mono text-[12px]">
                <div className="text-dim">keyTag {d.keyTag} · {d.algorithm} · {d.dnsKeyState}</div>
                {d.digests.map((g, j) => <div key={j} className="mt-1 break-all text-mut"><span className="text-accent">{g.digestType}</span> {d.keyTag} {g.digest}</div>)}
              </div>
            ))}
          </div>
        </div>}
      </div>

      <div className="mt-5 flex justify-between gap-2 border-t border-line pt-4">
        <button className="btn-ghost !text-bad hover:!bg-bad/10" onClick={() => confirm(`Unsign ${zone}? This removes DNSSEC entirely.`) && run(unsignZone(zone), 'Zone unsigned')}><ShieldOff size={15} /> Unsign zone</button>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>

      {adding && <AddKey zone={zone} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh() }} />}
    </>
  )
}

function AddKey({ zone, onClose, onDone }: { zone: string; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState<any>({ keyType: 'ZoneSigningKey', algorithm: 'ECDSA', curve: 'P256', hashAlgorithm: 'SHA256', keySize: 2048, rolloverDays: 90 })
  const [busy, setBusy] = useState(false)
  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }))
  const submit = async () => {
    setBusy(true)
    const p: Record<string, any> = { keyType: v.keyType, algorithm: v.algorithm, rolloverDays: v.rolloverDays }
    if (v.algorithm === 'RSA') { p.hashAlgorithm = v.hashAlgorithm; p.keySize = v.keySize } else p.curve = v.curve
    try { await addDnssecPrivateKey(zone, p); toast('Private key added (Generated). Publish to activate.'); onDone() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Add DNSSEC private key"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Adding...' : 'Add key'}</button></>}>
      <div className="space-y-3.5">
        <Field label="Key type">
          <select className="input w-full" value={v.keyType} onChange={e => { const t = e.target.value; set('keyType', t); set('rolloverDays', t === 'KeySigningKey' ? 0 : 90) }}>
            <option value="KeySigningKey">Key Signing Key (KSK)</option><option value="ZoneSigningKey">Zone Signing Key (ZSK)</option>
          </select>
        </Field>
        <AlgoFields v={v} set={set} />
        <Field label="Rollover (days, 0 = off)"><input className="input w-full" type="number" value={v.rolloverDays} onChange={e => set('rolloverDays', +e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
