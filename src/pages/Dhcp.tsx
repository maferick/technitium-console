import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Power, Trash2, Plus, Pin, PinOff, Pencil } from 'lucide-react'
import { getLeases, getScopes, setScopeEnabled, deleteScope, addReservedLease, removeReservedLease, saveScope, getScope } from '../lib/api'
import { relTime, timeAbs } from '../lib/format'
import { Card, CardHead, Chip, Spinner, Empty, Modal, Field, toast } from '../components/ui'

const ipKey = (ip: string) => ip.split('.').map(n => n.padStart(3, '0')).join('.')

export default function Dhcp() {
  const [tab, setTab] = useState<'Leases' | 'Scopes'>('Leases')
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">DHCP</h1>
      <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
        {(['Leases', 'Scopes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition ${tab === t ? 'bg-surface3 text-accent' : 'text-dim hover:text-white'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Leases' ? <Leases /> : <Scopes />}
    </div>
  )
}

function Leases() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['leases'], queryFn: getLeases, refetchInterval: 20_000 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['leases'] })
  const reserve = async (l: any) => { try { await addReservedLease(l.scope, l.hardwareAddress, l.address, l.hostName || ''); toast(`Reserved ${l.address}`); refresh() } catch (e: any) { toast(e?.message || 'Failed', 'err') } }
  const unreserve = async (l: any) => { try { await removeReservedLease(l.scope, l.hardwareAddress); toast(`Reservation removed`); refresh() } catch (e: any) { toast(e?.message || 'Failed', 'err') } }
  const leases = (data || [])
    .filter(l => !q || l.address.includes(q) || (l.hostName || '').toLowerCase().includes(q.toLowerCase()) || l.hardwareAddress.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => ipKey(a.address).localeCompare(ipKey(b.address)))
  if (isLoading) return <Spinner />
  return (
    <Card>
      <CardHead title={`Leases · ${data?.length || 0}`} right={<input className="input w-56" placeholder="filter IP / host / MAC…" value={q} onChange={e => setQ(e.target.value)} />} />
      {leases.length === 0 ? <Empty>No active leases.</Empty> :
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
              <th className="px-5 py-3">IP address</th><th className="px-5 py-3">Host</th><th className="px-5 py-3">MAC</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {leases.map((l, i) => (
                <tr key={i} className="group border-t border-line hover:bg-surface2">
                  <td className="px-5 py-2.5 font-mono text-[13px] text-txt">{l.address}</td>
                  <td className="px-5 py-2.5 font-mono text-[13px] text-dim">{l.hostName || '—'}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-mut">{l.hardwareAddress}</td>
                  <td className="px-5 py-2.5"><Chip className={l.type === 'Reserved' ? 'text-accent bg-accent/10' : 'text-dim bg-white/5'}>{l.type}</Chip></td>
                  <td className="px-5 py-2.5 font-mono text-xs text-mut" title={timeAbs(l.leaseExpires)}>{l.type === 'Reserved' ? 'never' : relTime(l.leaseExpires).replace(' ago', '')}</td>
                  <td className="px-5 py-2.5 text-right">
                    {l.type === 'Reserved'
                      ? <button onClick={() => unreserve(l)} title="Remove reservation" className="rounded-md p-1.5 text-mut opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"><PinOff size={14} /></button>
                      : <button onClick={() => reserve(l)} title="Reserve this IP" className="rounded-md p-1.5 text-mut opacity-0 transition hover:bg-accent/15 hover:text-accent group-hover:opacity-100"><Pin size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </Card>
  )
}

function Scopes() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['scopes'], queryFn: getScopes })
  const [resScope, setResScope] = useState<string | null>(null)
  const [editScope, setEditScope] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['scopes'] })
  const act = async (fn: Promise<any>, msg: string) => { try { await fn; toast(msg); refresh() } catch (e: any) { toast(e?.message || 'Failed', 'err') } }
  if (isLoading || !data) return <Spinner />
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary !py-1.5 text-xs" onClick={() => setCreating(true)}><Plus size={14} /> New scope</button></div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.length === 0 ? <Card><Empty>No scopes.</Empty></Card> :
          data.map((s, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-txt">{s.name}</div>
                <Chip className={s.enabled ? 'text-ok bg-ok/10' : 'text-mut bg-white/5'}>{s.enabled ? 'Enabled' : 'Disabled'}</Chip>
              </div>
              <div className="mt-3 space-y-1.5 font-mono text-[13px]">
                <Row k="Pool" v={`${s.startingAddress} – ${s.endingAddress}`} />
                <Row k="Subnet" v={`${s.networkAddress} / ${s.subnetMask}`} />
                <Row k="Interface" v={s.interfaceAddress} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <button className="btn-ghost !py-1.5 text-xs" onClick={() => setResScope(s.name)}><Plus size={13} /> Reservation</button>
                <button className="btn-ghost !py-1.5 text-xs" onClick={() => setEditScope(s)}><Pencil size={13} /> Edit</button>
                <button className="btn-ghost !py-1.5 text-xs" onClick={() => act(setScopeEnabled(s.name, !s.enabled), s.enabled ? 'Disabled' : 'Enabled')}><Power size={13} /> {s.enabled ? 'Disable' : 'Enable'}</button>
                <button className="btn-ghost !py-1.5 text-xs !text-bad hover:!bg-bad/10 ml-auto" onClick={() => confirm(`Delete scope "${s.name}"?`) && act(deleteScope(s.name), 'Scope deleted')}><Trash2 size={13} /></button>
              </div>
            </Card>
          ))}
      </div>
      {resScope && <AddReservation scope={resScope} onClose={() => setResScope(null)} onDone={() => { setResScope(null); qc.invalidateQueries({ queryKey: ['leases'] }) }} />}
      {(creating || editScope) && <ScopeModal scope={editScope} onClose={() => { setCreating(false); setEditScope(null) }} onDone={() => { setCreating(false); setEditScope(null); refresh() }} />}
    </div>
  )
}

// ---------- Full DHCP scope editor ----------

// Small uppercase section header, matching the Field label style.
const SectionHead = ({ children }: { children: string }) =>
  <div className="col-span-full mt-1 border-b border-line pb-1.5 text-[11px] font-bold uppercase tracking-wider text-dim">{children}</div>

// Toggle styled with the lime accent, used for all boolean scope options.
function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line2 bg-surface2 px-3 py-2 text-left transition hover:bg-surface3">
      <span>
        <span className="block text-[13px] font-medium text-txt">{label}</span>
        {hint && <span className="block text-[11px] text-mut">{hint}</span>}
      </span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? 'bg-accent' : 'bg-line2'}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-[#10210a] transition ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}

// Generic add/remove-row editor for the pipe-table fields (see TSIG keys editor in Settings.tsx).
function RowEditor<T extends Record<string, string>>({ label, rows, cols, blank, onChange }: {
  label: string
  rows: T[]
  cols: { k: keyof T; ph: string; type?: string }[]
  blank: T
  onChange: (rows: T[]) => void
}) {
  return (
    <div className="col-span-full">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mut">{label}</span>
        <button type="button" className="btn-ghost !py-1 !px-2 text-[11px]" onClick={() => onChange([...rows, { ...blank }])}><Plus size={12} /> Add</button>
      </div>
      {rows.length === 0
        ? <div className="rounded-lg border border-dashed border-line2 py-2.5 text-center text-[11px] text-mut">None</div>
        : <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                {cols.map(c => (
                  <input key={String(c.k)} className="input min-w-0 flex-1" type={c.type || 'text'} placeholder={c.ph}
                    value={r[c.k] as string}
                    onChange={e => { const a = rows.map(x => ({ ...x })); a[i] = { ...a[i], [c.k]: e.target.value }; onChange(a) }} />
                ))}
                <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-md p-2 text-mut transition hover:bg-bad/15 hover:text-bad"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>}
    </div>
  )
}

// ---- serialization helpers ----
// comma-list string -> array of trimmed non-empty values (used to seed inputs from getScope)
const fromList = (v: any): string => Array.isArray(v) ? v.join(', ') : (v ?? '')
// input string -> joined comma list of trimmed non-empty values
const toList = (v: string): string => v.split(',').map(s => s.trim()).filter(Boolean).join(',')
// flatten table rows: all cell values in column order joined with "|"; empty -> '' (param omitted by caller)
const toPipe = <T extends Record<string, string>>(rows: T[], cols: (keyof T)[]): string =>
  rows.flatMap(r => cols.map(c => (r[c] ?? '').trim())).join('|')

type StaticRoute = { destination: string; subnetMask: string; router: string }
type Exclusion = { startingAddress: string; endingAddress: string }
type Reserved = { hostName: string; hardwareAddress: string; address: string; comments: string }
type VendorInfo = { identifier: string; information: string }
type GenericOption = { code: string; value: string }

function ScopeModal({ scope, onClose, onDone }: { scope: any | null; onClose: () => void; onDone: () => void }) {
  const editing = !!scope
  const [busy, setBusy] = useState(false)

  // Scalar / list fields kept as a flat string/boolean record.
  const [f, setF] = useState<Record<string, any>>({
    name: scope?.name || '', newName: '',
    startingAddress: scope?.startingAddress || '', endingAddress: scope?.endingAddress || '',
    subnetMask: scope?.subnetMask || '255.255.255.0',
    leaseTimeDays: '1', leaseTimeHours: '0', leaseTimeMinutes: '0', offerDelayTime: '0',
    pingCheckEnabled: false, pingCheckTimeout: '1000', pingCheckRetries: '2',
    domainName: '', domainSearchList: '', dnsUpdates: true, dnsOverwriteForDynamicLease: false,
    dnsTtl: '900', useThisDnsServer: false, dnsServers: '',
    routerAddress: '', winsServers: '', ntpServers: '', ntpServerDomainNames: '',
    serverAddress: '', serverHostName: '', bootFileName: '',
    capwapAcIpAddresses: '', tftpServerAddresses: '',
    allowOnlyReservedLeases: false, blockLocallyAdministeredMacAddresses: false, ignoreClientIdentifierOption: false,
  })
  // Pipe-table fields kept as arrays of row objects.
  const [staticRoutes, setStaticRoutes] = useState<StaticRoute[]>([])
  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [reservedLeases, setReservedLeases] = useState<Reserved[]>([])
  const [vendorInfo, setVendorInfo] = useState<VendorInfo[]>([])
  const [genericOptions, setGenericOptions] = useState<GenericOption[]>([])

  // Load full detail when editing an existing scope.
  const { data: detail, isLoading } = useQuery({
    queryKey: ['scope', scope?.name],
    queryFn: () => getScope(scope.name),
    enabled: editing,
  })

  useEffect(() => {
    if (!detail) return
    const d = detail as any
    setF(s => ({
      ...s,
      name: d.name ?? s.name, newName: '',
      startingAddress: d.startingAddress ?? '', endingAddress: d.endingAddress ?? '',
      subnetMask: d.subnetMask ?? '255.255.255.0',
      leaseTimeDays: String(d.leaseTimeDays ?? 0), leaseTimeHours: String(d.leaseTimeHours ?? 0),
      leaseTimeMinutes: String(d.leaseTimeMinutes ?? 0), offerDelayTime: String(d.offerDelayTime ?? 0),
      pingCheckEnabled: !!d.pingCheckEnabled, pingCheckTimeout: String(d.pingCheckTimeout ?? 1000), pingCheckRetries: String(d.pingCheckRetries ?? 2),
      domainName: d.domainName ?? '', domainSearchList: fromList(d.domainSearchList),
      dnsUpdates: d.dnsUpdates ?? true, dnsOverwriteForDynamicLease: !!d.dnsOverwriteForDynamicLease,
      dnsTtl: String(d.dnsTtl ?? 900), useThisDnsServer: !!d.useThisDnsServer, dnsServers: fromList(d.dnsServers),
      routerAddress: d.routerAddress ?? '', winsServers: fromList(d.winsServers),
      ntpServers: fromList(d.ntpServers), ntpServerDomainNames: fromList(d.ntpServerDomainNames),
      serverAddress: d.serverAddress ?? '', serverHostName: d.serverHostName ?? '', bootFileName: d.bootFileName ?? '',
      capwapAcIpAddresses: fromList(d.capwapAcIpAddresses), tftpServerAddresses: fromList(d.tftpServerAddresses),
      allowOnlyReservedLeases: !!d.allowOnlyReservedLeases,
      blockLocallyAdministeredMacAddresses: !!d.blockLocallyAdministeredMacAddresses,
      ignoreClientIdentifierOption: !!d.ignoreClientIdentifierOption,
    }))
    setStaticRoutes((d.staticRoutes || []).map((r: any) => ({ destination: r.destination ?? '', subnetMask: r.subnetMask ?? '', router: r.router ?? '' })))
    setExclusions((d.exclusions || []).map((r: any) => ({ startingAddress: r.startingAddress ?? '', endingAddress: r.endingAddress ?? '' })))
    setReservedLeases((d.reservedLeases || []).map((r: any) => ({ hostName: r.hostName ?? '', hardwareAddress: r.hardwareAddress ?? '', address: r.address ?? '', comments: r.comments ?? '' })))
    setVendorInfo((d.vendorInfo || []).map((r: any) => ({ identifier: r.identifier ?? '', information: r.information ?? '' })))
    setGenericOptions((d.genericOptions || []).map((r: any) => ({ code: String(r.code ?? ''), value: r.value ?? '' })))
  }, [detail])

  const set = (k: string, v: any) => setF(s => ({ ...s, [k]: v }))

  const submit = async () => {
    if (!f.name || !f.startingAddress || !f.endingAddress || !f.subnetMask) {
      toast('Name, pool range and subnet mask are required', 'err'); return
    }
    setBusy(true)
    // Build the flat param object. Comma lists are normalized; pipe tables flattened.
    const p: Record<string, any> = {
      name: f.name,
      startingAddress: f.startingAddress, endingAddress: f.endingAddress, subnetMask: f.subnetMask,
      leaseTimeDays: f.leaseTimeDays, leaseTimeHours: f.leaseTimeHours, leaseTimeMinutes: f.leaseTimeMinutes,
      offerDelayTime: f.offerDelayTime,
      pingCheckEnabled: f.pingCheckEnabled, pingCheckTimeout: f.pingCheckTimeout, pingCheckRetries: f.pingCheckRetries,
      domainName: f.domainName, domainSearchList: toList(f.domainSearchList),
      dnsUpdates: f.dnsUpdates, dnsOverwriteForDynamicLease: f.dnsOverwriteForDynamicLease, dnsTtl: f.dnsTtl,
      useThisDnsServer: f.useThisDnsServer,
      dnsServers: f.useThisDnsServer ? '' : toList(f.dnsServers),
      routerAddress: f.routerAddress, winsServers: toList(f.winsServers),
      ntpServers: toList(f.ntpServers), ntpServerDomainNames: toList(f.ntpServerDomainNames),
      serverAddress: f.serverAddress, serverHostName: f.serverHostName, bootFileName: f.bootFileName,
      capwapAcIpAddresses: toList(f.capwapAcIpAddresses), tftpServerAddresses: toList(f.tftpServerAddresses),
      allowOnlyReservedLeases: f.allowOnlyReservedLeases,
      blockLocallyAdministeredMacAddresses: f.blockLocallyAdministeredMacAddresses,
      ignoreClientIdentifierOption: f.ignoreClientIdentifierOption,
    }
    if (editing && f.newName.trim() && f.newName.trim() !== f.name) p.newName = f.newName.trim()

    // Pipe tables: only send when at least one row exists (omit empty so we never clear them blindly).
    const sr = toPipe(staticRoutes.filter(r => r.destination || r.subnetMask || r.router), ['destination', 'subnetMask', 'router'])
    if (sr) p.staticRoutes = sr
    const ex = toPipe(exclusions.filter(r => r.startingAddress || r.endingAddress), ['startingAddress', 'endingAddress'])
    if (ex) p.exclusions = ex
    const rl = toPipe(reservedLeases.filter(r => r.hardwareAddress || r.address), ['hostName', 'hardwareAddress', 'address', 'comments'])
    if (rl) p.reservedLeases = rl
    const vi = toPipe(vendorInfo.filter(r => r.identifier || r.information), ['identifier', 'information'])
    if (vi) p.vendorInfo = vi
    const go = toPipe(genericOptions.filter(r => r.code || r.value), ['code', 'value'])
    if (go) p.genericOptions = go

    try { await saveScope(p); toast(editing ? 'Scope updated' : 'Scope created'); onDone() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={editing ? `Edit scope · ${scope.name}` : 'New scope'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : editing ? 'Save' : 'Create'}</button></>}>
      {editing && isLoading ? <Spinner /> : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <SectionHead>Basics</SectionHead>
          <Field label="Name"><input className="input w-full" disabled={editing} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
          {editing
            ? <Field label="Rename to (optional)"><input className="input w-full" placeholder="leave blank to keep" value={f.newName} onChange={e => set('newName', e.target.value)} /></Field>
            : <div className="hidden sm:block" />}
          <Field label="Pool start"><input className="input w-full" placeholder="192.168.1.100" value={f.startingAddress} onChange={e => set('startingAddress', e.target.value)} /></Field>
          <Field label="Pool end"><input className="input w-full" placeholder="192.168.1.200" value={f.endingAddress} onChange={e => set('endingAddress', e.target.value)} /></Field>
          <Field label="Subnet mask"><input className="input w-full" value={f.subnetMask} onChange={e => set('subnetMask', e.target.value)} /></Field>

          <SectionHead>Lease</SectionHead>
          <Field label="Lease days"><input className="input w-full" type="number" value={f.leaseTimeDays} onChange={e => set('leaseTimeDays', e.target.value)} /></Field>
          <Field label="Lease hours"><input className="input w-full" type="number" value={f.leaseTimeHours} onChange={e => set('leaseTimeHours', e.target.value)} /></Field>
          <Field label="Lease minutes"><input className="input w-full" type="number" value={f.leaseTimeMinutes} onChange={e => set('leaseTimeMinutes', e.target.value)} /></Field>
          <Field label="Offer delay (ms)"><input className="input w-full" type="number" value={f.offerDelayTime} onChange={e => set('offerDelayTime', e.target.value)} /></Field>

          <SectionHead>Ping check</SectionHead>
          <div className="col-span-full"><Toggle label="Ping check enabled" hint="Ping an address before offering it" checked={f.pingCheckEnabled} onChange={v => set('pingCheckEnabled', v)} /></div>
          <Field label="Ping timeout (ms)"><input className="input w-full" type="number" disabled={!f.pingCheckEnabled} value={f.pingCheckTimeout} onChange={e => set('pingCheckTimeout', e.target.value)} /></Field>
          <Field label="Ping retries"><input className="input w-full" type="number" disabled={!f.pingCheckEnabled} value={f.pingCheckRetries} onChange={e => set('pingCheckRetries', e.target.value)} /></Field>

          <SectionHead>DNS</SectionHead>
          <Field label="Domain name"><input className="input w-full" placeholder="fritz.box" value={f.domainName} onChange={e => set('domainName', e.target.value)} /></Field>
          <Field label="DNS TTL (s)"><input className="input w-full" type="number" value={f.dnsTtl} onChange={e => set('dnsTtl', e.target.value)} /></Field>
          <Field label="Domain search list (comma)"><input className="input w-full" placeholder="lan, fritz.box" value={f.domainSearchList} onChange={e => set('domainSearchList', e.target.value)} /></Field>
          <div className="col-span-full grid gap-3.5 sm:grid-cols-2">
            <Toggle label="DNS updates" hint="Auto-create A/PTR for leases" checked={f.dnsUpdates} onChange={v => set('dnsUpdates', v)} />
            <Toggle label="Overwrite for dynamic lease" checked={f.dnsOverwriteForDynamicLease} onChange={v => set('dnsOverwriteForDynamicLease', v)} />
            <Toggle label="Use this DNS server" hint="Hand out this server as the resolver" checked={f.useThisDnsServer} onChange={v => set('useThisDnsServer', v)} />
          </div>
          <Field label="DNS servers (comma)"><input className="input w-full" disabled={f.useThisDnsServer} placeholder={f.useThisDnsServer ? 'using this server' : '192.168.1.10, 192.168.1.11'} value={f.dnsServers} onChange={e => set('dnsServers', e.target.value)} /></Field>

          <SectionHead>Gateway / servers</SectionHead>
          <Field label="Router (gateway)"><input className="input w-full" placeholder="192.168.1.1" value={f.routerAddress} onChange={e => set('routerAddress', e.target.value)} /></Field>
          <Field label="WINS servers (comma)"><input className="input w-full" value={f.winsServers} onChange={e => set('winsServers', e.target.value)} /></Field>
          <Field label="NTP servers (comma)"><input className="input w-full" value={f.ntpServers} onChange={e => set('ntpServers', e.target.value)} /></Field>
          <Field label="NTP server domain names (comma)"><input className="input w-full" placeholder="pool.ntp.org" value={f.ntpServerDomainNames} onChange={e => set('ntpServerDomainNames', e.target.value)} /></Field>

          <SectionHead>Boot / PXE</SectionHead>
          <Field label="Server address (next-server)"><input className="input w-full" value={f.serverAddress} onChange={e => set('serverAddress', e.target.value)} /></Field>
          <Field label="Server host name"><input className="input w-full" value={f.serverHostName} onChange={e => set('serverHostName', e.target.value)} /></Field>
          <Field label="Boot file name"><input className="input w-full" placeholder="pxelinux.0" value={f.bootFileName} onChange={e => set('bootFileName', e.target.value)} /></Field>

          <SectionHead>Advanced lists</SectionHead>
          <RowEditor label="Static routes" rows={staticRoutes} onChange={setStaticRoutes}
            blank={{ destination: '', subnetMask: '', router: '' }}
            cols={[{ k: 'destination', ph: 'destination' }, { k: 'subnetMask', ph: 'mask' }, { k: 'router', ph: 'router' }]} />
          <RowEditor label="Exclusions" rows={exclusions} onChange={setExclusions}
            blank={{ startingAddress: '', endingAddress: '' }}
            cols={[{ k: 'startingAddress', ph: 'start address' }, { k: 'endingAddress', ph: 'end address' }]} />
          <RowEditor label="Reserved leases" rows={reservedLeases} onChange={setReservedLeases}
            blank={{ hostName: '', hardwareAddress: '', address: '', comments: '' }}
            cols={[{ k: 'hostName', ph: 'host' }, { k: 'hardwareAddress', ph: 'MAC' }, { k: 'address', ph: 'IP' }, { k: 'comments', ph: 'comments' }]} />
          <RowEditor label="Vendor info" rows={vendorInfo} onChange={setVendorInfo}
            blank={{ identifier: '', information: '' }}
            cols={[{ k: 'identifier', ph: 'identifier' }, { k: 'information', ph: 'information (hex)' }]} />
          <RowEditor label="Generic options" rows={genericOptions} onChange={setGenericOptions}
            blank={{ code: '', value: '' }}
            cols={[{ k: 'code', ph: 'code', type: 'number' }, { k: 'value', ph: 'value (hex)' }]} />
          <Field label="CAPWAP AC IPs (comma)"><input className="input w-full" value={f.capwapAcIpAddresses} onChange={e => set('capwapAcIpAddresses', e.target.value)} /></Field>
          <Field label="TFTP server addresses (comma)"><input className="input w-full" value={f.tftpServerAddresses} onChange={e => set('tftpServerAddresses', e.target.value)} /></Field>

          <SectionHead>Flags</SectionHead>
          <div className="col-span-full grid gap-3.5 sm:grid-cols-2">
            <Toggle label="Allow only reserved leases" checked={f.allowOnlyReservedLeases} onChange={v => set('allowOnlyReservedLeases', v)} />
            <Toggle label="Block locally administered MACs" checked={f.blockLocallyAdministeredMacAddresses} onChange={v => set('blockLocallyAdministeredMacAddresses', v)} />
            <Toggle label="Ignore client identifier option" checked={f.ignoreClientIdentifierOption} onChange={v => set('ignoreClientIdentifierOption', v)} />
          </div>
        </div>
      )}
    </Modal>
  )
}

function AddReservation({ scope, onClose, onDone }: { scope: string; onClose: () => void; onDone: () => void }) {
  const [mac, setMac] = useState(''); const [ip, setIp] = useState(''); const [c, setC] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!mac || !ip) return; setBusy(true)
    try { await addReservedLease(scope, mac.trim(), ip.trim(), c.trim()); toast('Reservation added'); onDone() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Add reservation · ${scope}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Adding…' : 'Add'}</button></>}>
      <div className="space-y-3.5">
        <Field label="MAC address"><input className="input w-full" autoFocus placeholder="AA:BB:CC:DD:EE:FF" value={mac} onChange={e => setMac(e.target.value)} /></Field>
        <Field label="IP address"><input className="input w-full" placeholder="192.168.1.50" value={ip} onChange={e => setIp(e.target.value)} /></Field>
        <Field label="Comment"><input className="input w-full" placeholder="(optional)" value={c} onChange={e => setC(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span className="text-mut">{k}</span><span className="text-txt">{v}</span></div>
