import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { getZoneOptions, setZoneOptions, ZoneOptions, UpdateSecurityPolicy } from '../lib/api'
import { Modal, Field, Spinner, toast } from './ui'

// Access-control selects per the Technitium zone options contract.
const QUERY_ACCESS = ['Deny', 'Allow', 'AllowOnlyPrivateNetworks', 'AllowOnlyZoneNameServers', 'UseSpecifiedNetworkACL', 'AllowZoneNameServersAndUseSpecifiedNetworkACL']
const ZONE_TRANSFER = ['Deny', 'Allow', 'AllowOnlyZoneNameServers', 'UseSpecifiedNetworkACL', 'AllowZoneNameServersAndUseSpecifiedNetworkACL']
const NOTIFY = ['None', 'ZoneNameServers', 'SpecifiedNameServers', 'BothZoneAndSpecifiedNameServers']
const UPDATE = ['Deny', 'Allow', 'AllowOnlyZoneNameServers', 'UseSpecifiedNetworkACL', 'AllowZoneNameServersAndUseSpecifiedNetworkACL']
const REC_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'PTR', 'NS', 'CAA', 'ANY']

const usesAcl = (v: string) => v === 'UseSpecifiedNetworkACL' || v === 'AllowZoneNameServersAndUseSpecifiedNetworkACL'
const toLines = (a?: string[]) => (a || []).join('\n')
// comma-join for the API; an empty list sends 'false' to clear existing values
const aclParam = (s: string) => { const v = s.split('\n').map(x => x.trim()).filter(Boolean); return v.length ? v.join(',') : 'false' }

const SectionTitle = ({ children }: { children: React.ReactNode }) =>
  <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-accent">{children}</div>

export default function ZoneOptionsModal({ zone, onClose, onDone }: { zone: string; onClose: () => void; onDone: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['zoneOptions', zone], queryFn: () => getZoneOptions(zone) })
  return (
    <Modal open onClose={onClose} wide title={`Zone options - ${zone}`}
      footer={null as any}>
      {isLoading || !data ? <Spinner label="Loading options..." /> : <Body o={data} onClose={onClose} onDone={onDone} />}
    </Modal>
  )
}

function Body({ o, onClose, onDone }: { o: ZoneOptions; onClose: () => void; onDone: () => void }) {
  const type = o.type
  const tsigAvail = o.availableTsigKeyNames || []
  const catAvail = o.availableCatalogZoneNames || []

  const [queryAccess, setQueryAccess] = useState(o.queryAccess || 'Allow')
  const [queryAcl, setQueryAcl] = useState(toLines(o.queryAccessNetworkACL))
  const [zoneTransfer, setZoneTransfer] = useState(o.zoneTransfer || 'Deny')
  const [transferAcl, setTransferAcl] = useState(toLines(o.zoneTransferNetworkACL))
  const [transferKeys, setTransferKeys] = useState<string[]>(o.zoneTransferTsigKeyNames || [])
  const [notify, setNotify] = useState(o.notify || 'None')
  const [notifyNs, setNotifyNs] = useState(toLines(o.notifyNameServers))
  const [update, setUpdate] = useState(o.update || 'Deny')
  const [updateAcl, setUpdateAcl] = useState(toLines(o.updateNetworkACL))
  const [policies, setPolicies] = useState<UpdateSecurityPolicy[]>(o.updateSecurityPolicies || [])
  const [catalog, setCatalog] = useState(o.catalog || '')
  const [busy, setBusy] = useState(false)

  const showTransfer = ['Primary', 'Secondary', 'Forwarder', 'Catalog'].includes(type)
  const showNotify = ['Primary', 'Secondary', 'Forwarder', 'Catalog'].includes(type)
  const showUpdate = ['Primary', 'Secondary', 'Forwarder'].includes(type)
  const showPolicies = ['Primary', 'Forwarder'].includes(type)
  const showCatalog = ['Primary', 'Secondary', 'Stub', 'Forwarder'].includes(type)

  const toggleKey = (k: string) => setTransferKeys(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k])
  const togglePolType = (i: number, t: string) => setPolicies(s => s.map((p, j) => j !== i ? p : ({ ...p, allowedTypes: p.allowedTypes.includes(t) ? p.allowedTypes.filter(x => x !== t) : [...p.allowedTypes, t] })))

  const save = async () => {
    setBusy(true)
    const patch: Record<string, any> = { queryAccess }
    if (usesAcl(queryAccess)) patch.queryAccessNetworkACL = aclParam(queryAcl)
    if (showTransfer) {
      patch.zoneTransfer = zoneTransfer
      if (usesAcl(zoneTransfer)) patch.zoneTransferNetworkACL = aclParam(transferAcl)
      patch.zoneTransferTsigKeyNames = transferKeys.length ? transferKeys.join(',') : 'false'
    }
    if (showNotify) {
      patch.notify = notify
      if (notify === 'SpecifiedNameServers' || notify === 'BothZoneAndSpecifiedNameServers')
        patch.notifyNameServers = notifyNs.split('\n').map(x => x.trim()).filter(Boolean).join(',')
    }
    if (showUpdate) {
      patch.update = update
      if (usesAcl(update)) patch.updateNetworkACL = aclParam(updateAcl)
    }
    if (showPolicies) {
      const valid = policies.filter(p => p.tsigKeyName && p.domain && p.allowedTypes.length)
      patch.updateSecurityPolicies = valid.length
        ? valid.map(p => `${p.tsigKeyName}|${p.domain}|${p.allowedTypes.join(',')}`).join('|') : 'false'
    }
    if (showCatalog) patch.catalog = catalog
    try { await setZoneOptions(o.name, patch); toast('Zone options saved'); onDone() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }

  return (
    <>
      <div className="space-y-4">
        <SectionTitle>Query access</SectionTitle>
        <Field label="Who may query this zone">
          <select className="input w-full" value={queryAccess} onChange={e => setQueryAccess(e.target.value)}>{QUERY_ACCESS.map(v => <option key={v}>{v}</option>)}</select>
        </Field>
        {usesAcl(queryAccess) && <Field label="Query network ACL (one per line, prefix ! to deny)"><textarea className="input min-h-[70px] w-full font-mono !text-[12px]" value={queryAcl} onChange={e => setQueryAcl(e.target.value)} /></Field>}

        {showTransfer && <>
          <SectionTitle>Zone transfer</SectionTitle>
          <Field label="Allow zone transfer (AXFR/IXFR)">
            <select className="input w-full" value={zoneTransfer} onChange={e => setZoneTransfer(e.target.value)}>{ZONE_TRANSFER.map(v => <option key={v}>{v}</option>)}</select>
          </Field>
          {usesAcl(zoneTransfer) && <Field label="Transfer network ACL (one per line, prefix ! to deny)"><textarea className="input min-h-[70px] w-full font-mono !text-[12px]" value={transferAcl} onChange={e => setTransferAcl(e.target.value)} /></Field>}
          <Field label="TSIG keys authorized for transfer">
            {tsigAvail.length === 0 ? <div className="text-sm text-mut">No TSIG keys configured (see Settings, TSIG).</div> :
              <div className="flex flex-wrap gap-2">{tsigAvail.map(k => (
                <button key={k} type="button" onClick={() => toggleKey(k)}
                  className={`chip cursor-pointer ${transferKeys.includes(k) ? 'text-[#10210a] bg-accent' : 'text-dim bg-white/5'}`}>{k}</button>
              ))}</div>}
          </Field>
        </>}

        {showNotify && <>
          <SectionTitle>Notify</SectionTitle>
          <Field label="Notify secondary servers on change">
            <select className="input w-full" value={notify} onChange={e => setNotify(e.target.value)}>{NOTIFY.map(v => <option key={v}>{v}</option>)}</select>
          </Field>
          {(notify === 'SpecifiedNameServers' || notify === 'BothZoneAndSpecifiedNameServers') &&
            <Field label="Notify name servers (one IP per line)"><textarea className="input min-h-[60px] w-full font-mono !text-[12px]" value={notifyNs} onChange={e => setNotifyNs(e.target.value)} /></Field>}
        </>}

        {showUpdate && <>
          <SectionTitle>Dynamic updates (RFC 2136)</SectionTitle>
          <Field label="Allow dynamic DNS updates">
            <select className="input w-full" value={update} onChange={e => setUpdate(e.target.value)}>{UPDATE.map(v => <option key={v}>{v}</option>)}</select>
          </Field>
          {usesAcl(update) && <Field label="Update network ACL (one per line, prefix ! to deny)"><textarea className="input min-h-[70px] w-full font-mono !text-[12px]" value={updateAcl} onChange={e => setUpdateAcl(e.target.value)} /></Field>}
          {showPolicies && <Field label="Update security policies (TSIG key, domain, allowed types)">
            <div className="space-y-2">
              {policies.length === 0 && <div className="text-sm text-mut">No policies. Updates are not TSIG-restricted.</div>}
              {policies.map((p, i) => (
                <div key={i} className="rounded-lg border border-line bg-surface2/40 p-2.5">
                  <div className="grid grid-cols-[1fr_1fr_32px] gap-2">
                    <select className="input" value={p.tsigKeyName} onChange={e => setPolicies(s => s.map((x, j) => j === i ? { ...x, tsigKeyName: e.target.value } : x))}>
                      <option value="">(TSIG key)</option>{tsigAvail.map(k => <option key={k}>{k}</option>)}
                    </select>
                    <input className="input" placeholder="domain (e.g. *.example.com)" value={p.domain} onChange={e => setPolicies(s => s.map((x, j) => j === i ? { ...x, domain: e.target.value } : x))} />
                    <button type="button" onClick={() => setPolicies(s => s.filter((_, j) => j !== i))} className="rounded-md p-2 text-mut hover:bg-bad/15 hover:text-bad"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{REC_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => togglePolType(i, t)}
                      className={`chip cursor-pointer !text-[11px] ${p.allowedTypes.includes(t) ? 'text-[#10210a] bg-accent' : 'text-dim bg-white/5'}`}>{t}</button>
                  ))}</div>
                </div>
              ))}
              <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => setPolicies(s => [...s, { tsigKeyName: '', domain: '', allowedTypes: [] }])}><Plus size={14} /> Add policy</button>
            </div>
          </Field>}
        </>}

        {showCatalog && <>
          <SectionTitle>Catalog</SectionTitle>
          <Field label="Catalog zone membership">
            <select className="input w-full" value={catalog} onChange={e => setCatalog(e.target.value)}>
              <option value="">(none)</option>{catAvail.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </>}
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save options'}</button>
      </div>
    </>
  )
}
