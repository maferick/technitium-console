import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Plus, Trash2, Lock, AlertTriangle, Download, Upload } from 'lucide-react'
import { getSettings, saveSettings, settingsBackupUrl, restoreSettings, BackupFlags } from '../lib/api'
import { Card, CardHead, Spinner, Field, toast } from '../components/ui'

const TABS = ['General', 'Web Service', 'Optional Protocols', 'Proxy & Forwarders', 'Recursion', 'Blocking', 'TSIG', 'Backup & Restore'] as const
type Tab = typeof TABS[number]
const FWD_PROTO = ['Udp', 'Tcp', 'Tls', 'Https', 'Quic']
const BLOCK_TYPE = ['AnyAddress', 'NxDomain', 'CustomAddress']
const RECURSION = ['Allow', 'AllowOnlyForPrivateNetworks', 'UseSpecifiedNetworkACL', 'Deny']
const PROXY_TYPE = ['None', 'Http', 'Socks5']
const TSIG_ALGO = ['hmac-sha256', 'hmac-sha512', 'hmac-sha384', 'hmac-sha1', 'hmac-md5']

const toList = (v: any) => Array.isArray(v) ? v.join('\n') : (v || '')
const fromList = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean).join(',')

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return <button onClick={() => set(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-accent' : 'bg-surface3'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></button>
}
const TRow = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) =>
  <div className="flex items-center justify-between py-2.5"><span className="text-sm text-dim">{label}</span><Toggle on={on} set={set} /></div>
const RO = ({ label, value }: { label: string; value: string }) => (
  <Field label={label}><div className="flex items-center gap-2 rounded-lg border border-line bg-surface2/40 px-3 py-2 font-mono text-[12px] text-mut"><Lock size={12} />{value || '—'}</div></Field>
)
const LockoutNote = ({ children }: { children: string }) => (
  <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[12px] text-warn"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{children}</div>
)

// Backup / restore item set (key + label). Defaults differ per direction, handled below.
const BACKUP_ITEMS: { k: keyof BackupFlags; label: string }[] = [
  { k: 'dnsSettings', label: 'DNS settings' },
  { k: 'authConfig', label: 'Auth config (users, groups, permissions)' },
  { k: 'webServiceSettings', label: 'Web service settings' },
  { k: 'logSettings', label: 'Log settings' },
  { k: 'zones', label: 'Zones' },
  { k: 'allowedZones', label: 'Allowed zones' },
  { k: 'blockedZones', label: 'Blocked zones' },
  { k: 'scopes', label: 'DHCP scopes' },
  { k: 'blockLists', label: 'Block lists' },
  { k: 'apps', label: 'DNS apps' },
  { k: 'clusterConfig', label: 'Cluster config' },
  { k: 'stats', label: 'Stats' },
  { k: 'logs', label: 'Log files' },
]
const BACKUP_DEFAULTS: BackupFlags = { dnsSettings: true, authConfig: true, zones: true, allowedZones: true, blockedZones: true, scopes: true, blockLists: true, apps: true, logSettings: true }
const RESTORE_DEFAULTS: BackupFlags = { dnsSettings: true }

function CheckRow({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm text-dim">
      <input type="checkbox" checked={on} onChange={e => set(e.target.checked)} className="h-4 w-4 shrink-0 accent-accent" />
      {label}
    </label>
  )
}

export default function Settings() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [tab, setTab] = useState<Tab>('General')
  const [f, setF] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [backupFlags, setBackupFlags] = useState<BackupFlags>(BACKUP_DEFAULTS)
  const [restoreFlags, setRestoreFlags] = useState<BackupFlags>(RESTORE_DEFAULTS)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [deleteExisting, setDeleteExisting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  useEffect(() => { if (data && !f) setF({ ...data, tsigKeys: (data.tsigKeys || []).map((k: any) => ({ ...k })) }) }, [data])
  if (isLoading || !f) return <Spinner label="Loading settings…" />
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))

  const save = async () => {
    setBusy(true)
    const tsig = (f.tsigKeys || []).filter((k: any) => k.keyName && k.sharedSecret)
      .map((k: any) => `${k.keyName}|${k.sharedSecret}|${k.algorithmName}`).join('|') || 'false'
    const patch: any = {
      dnsServerDomain: f.dnsServerDomain, defaultRecordTtl: f.defaultRecordTtl, udpPayloadSize: f.udpPayloadSize,
      preferIPv6: f.preferIPv6, dnssecValidation: f.dnssecValidation, serveStale: f.serveStale, serveStaleTtl: f.serveStaleTtl,
      dnsAppsEnableAutomaticUpdate: f.dnsAppsEnableAutomaticUpdate,
      enableLogging: f.enableLogging, logQueries: f.logQueries, useLocalTime: f.useLocalTime, maxLogFileDays: f.maxLogFileDays, maxStatFileDays: f.maxStatFileDays,
      proxyType: (f.proxyType || 'None'), proxyAddress: f.proxyAddress || '', proxyPort: f.proxyPort || 0, proxyUsername: f.proxyUsername || '', proxyPassword: f.proxyPassword || '',
      forwarderProtocol: f.forwarderProtocol, forwarders: fromList(toList(f.forwarders)) || 'false', concurrentForwarding: f.concurrentForwarding, forwarderRetries: f.forwarderRetries, forwarderTimeout: f.forwarderTimeout,
      recursion: f.recursion, randomizeName: f.randomizeName, qnameMinimization: f.qnameMinimization, resolverRetries: f.resolverRetries, resolverTimeout: f.resolverTimeout, resolverConcurrency: f.resolverConcurrency, resolverMaxStackCount: f.resolverMaxStackCount,
      enableBlocking: f.enableBlocking, blockingType: f.blockingType, blockingAnswerTtl: f.blockingAnswerTtl, allowTxtBlockingReport: f.allowTxtBlockingReport,
      blockListUpdateIntervalHours: f.blockListUpdateIntervalHours, blockingBypassList: fromList(toList(f.blockingBypassList)), blockListUrls: fromList(toList(f.blockListUrls)),
      tsigKeys: tsig,
      // ---- Web service & HTTPS (lockout-risk) ----
      webServiceLocalAddresses: fromList(toList(f.webServiceLocalAddresses)),
      webServiceHttpPort: f.webServiceHttpPort, webServiceTlsPort: f.webServiceTlsPort,
      webServiceEnableTls: f.webServiceEnableTls, webServiceEnableHttp3: f.webServiceEnableHttp3,
      webServiceHttpToTlsRedirect: f.webServiceHttpToTlsRedirect, webServiceUseSelfSignedTlsCertificate: f.webServiceUseSelfSignedTlsCertificate,
      webServiceTlsCertificatePath: f.webServiceTlsCertificatePath || '', webServiceTlsCertificatePassword: f.webServiceTlsCertificatePassword || '',
      webServiceReverseProxyAddresses: fromList(toList(f.webServiceReverseProxyAddresses)), webServiceRealIpHeader: f.webServiceRealIpHeader || '',
      // ---- DNS listen endpoints (lockout-risk) ----
      dnsServerLocalEndPoints: fromList(toList(f.dnsServerLocalEndPoints)),
      dnsServerIPv4SourceAddresses: fromList(toList(f.dnsServerIPv4SourceAddresses)),
      dnsServerIPv6SourceAddresses: fromList(toList(f.dnsServerIPv6SourceAddresses)),
      // ---- Optional protocols (DoT / DoH / DoQ) ----
      enableDnsOverTls: f.enableDnsOverTls, enableDnsOverHttps: f.enableDnsOverHttps, enableDnsOverHttp3: f.enableDnsOverHttp3,
      enableDnsOverQuic: f.enableDnsOverQuic, enableDnsOverHttp: f.enableDnsOverHttp,
      enableDnsOverUdpProxy: f.enableDnsOverUdpProxy, enableDnsOverTcpProxy: f.enableDnsOverTcpProxy,
      dnsOverTlsPort: f.dnsOverTlsPort, dnsOverHttpsPort: f.dnsOverHttpsPort, dnsOverQuicPort: f.dnsOverQuicPort,
      dnsOverHttpPort: f.dnsOverHttpPort, dnsOverUdpProxyPort: f.dnsOverUdpProxyPort, dnsOverTcpProxyPort: f.dnsOverTcpProxyPort,
      dnsTlsCertificatePath: f.dnsTlsCertificatePath || '', dnsTlsCertificatePassword: f.dnsTlsCertificatePassword || '',
      dnsReverseProxyNetworkACL: fromList(toList(f.dnsReverseProxyNetworkACL)), dnsOverHttpRealIpHeader: f.dnsOverHttpRealIpHeader || '',
    }
    try { await saveSettings(patch); toast('Settings saved'); setF(null); qc.invalidateQueries({ queryKey: ['settings'] }) }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }

  const downloadBackup = () => {
    const a = document.createElement('a')
    a.href = settingsBackupUrl(backupFlags)
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const doRestore = async () => {
    if (!restoreFile) return
    if (!window.confirm('Restoring will overwrite the selected configuration and may restart services. Continue?')) return
    setRestoring(true)
    try {
      await restoreSettings(restoreFile, { ...restoreFlags, deleteExistingFiles: deleteExisting })
      toast('Restore complete')
      toast('The server may need a moment to apply changes.')
      qc.invalidateQueries({ queryKey: ['settings'] })
    } catch (e: any) { toast(e?.message || 'Restore failed', 'err') } finally { setRestoring(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Settings</h1>
        <button className="btn-primary" disabled={busy} onClick={save}><Save size={15} /> {busy ? 'Saving…' : 'Save changes'}</button>
      </div>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition ${tab === t ? 'bg-surface3 text-accent' : 'text-dim hover:text-white'}`}>{t}</button>)}
      </div>

      {tab === 'General' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardHead title="Server" /><div className="space-y-3.5 p-5">
            <Field label="Server domain"><input className="input w-full" value={f.dnsServerDomain || ''} onChange={e => set('dnsServerDomain', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default record TTL"><input className="input w-full" type="number" value={f.defaultRecordTtl} onChange={e => set('defaultRecordTtl', +e.target.value)} /></Field>
              <Field label="UDP payload size"><input className="input w-full" type="number" value={f.udpPayloadSize} onChange={e => set('udpPayloadSize', +e.target.value)} /></Field>
            </div>
            <TRow label="Prefer IPv6" on={!!f.preferIPv6} set={v => set('preferIPv6', v)} />
            <TRow label="DNSSEC validation" on={!!f.dnssecValidation} set={v => set('dnssecValidation', v)} />
            <TRow label="Serve stale" on={!!f.serveStale} set={v => set('serveStale', v)} />
            <TRow label="Auto-update apps" on={!!f.dnsAppsEnableAutomaticUpdate} set={v => set('dnsAppsEnableAutomaticUpdate', v)} />
            <p className="pt-1 text-xs text-mut">DNS listen endpoints and web service binding moved to the Web Service tab.</p>
          </div></Card>
          <Card><CardHead title="Logging" /><div className="space-y-1 p-5">
            <TRow label="Diagnostic logging" on={!!f.enableLogging} set={v => set('enableLogging', v)} />
            <TRow label="Log every query (verbose)" on={!!f.logQueries} set={v => set('logQueries', v)} />
            <TRow label="Use local time in logs" on={!!f.useLocalTime} set={v => set('useLocalTime', v)} />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field label="Max log days"><input className="input w-full" type="number" value={f.maxLogFileDays} onChange={e => set('maxLogFileDays', +e.target.value)} /></Field>
              <Field label="Max stats days"><input className="input w-full" type="number" value={f.maxStatFileDays} onChange={e => set('maxStatFileDays', +e.target.value)} /></Field>
            </div>
          </div></Card>
        </div>
      )}

      {tab === 'Web Service' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardHead title="Web service & HTTPS" /><div className="space-y-3.5 p-5">
            <Field label="Web service bind addresses (one per line)"><textarea className="input min-h-[80px] w-full" value={toList(f.webServiceLocalAddresses)} onChange={e => set('webServiceLocalAddresses', e.target.value)} /></Field>
            <LockoutNote>Changing the web service bind addresses or ports can lock you out of this console.</LockoutNote>
            <div className="grid grid-cols-2 gap-3">
              <Field label="HTTP port"><input className="input w-full" type="number" value={f.webServiceHttpPort} onChange={e => set('webServiceHttpPort', +e.target.value)} /></Field>
              <Field label="TLS port"><input className="input w-full" type="number" value={f.webServiceTlsPort} onChange={e => set('webServiceTlsPort', +e.target.value)} /></Field>
            </div>
            <TRow label="Enable TLS (HTTPS)" on={!!f.webServiceEnableTls} set={v => set('webServiceEnableTls', v)} />
            <TRow label="Enable HTTP/3" on={!!f.webServiceEnableHttp3} set={v => set('webServiceEnableHttp3', v)} />
            <TRow label="Redirect HTTP to TLS" on={!!f.webServiceHttpToTlsRedirect} set={v => set('webServiceHttpToTlsRedirect', v)} />
            <TRow label="Use self-signed TLS certificate" on={!!f.webServiceUseSelfSignedTlsCertificate} set={v => set('webServiceUseSelfSignedTlsCertificate', v)} />
            <Field label="TLS certificate path"><input className="input w-full" autoComplete="off" value={f.webServiceTlsCertificatePath || ''} onChange={e => set('webServiceTlsCertificatePath', e.target.value)} /></Field>
            <Field label="TLS certificate password"><input className="input w-full" type="password" autoComplete="new-password" value={f.webServiceTlsCertificatePassword || ''} onChange={e => set('webServiceTlsCertificatePassword', e.target.value)} /></Field>
            <Field label="Reverse proxy addresses (one per line)"><textarea className="input min-h-[64px] w-full" value={toList(f.webServiceReverseProxyAddresses)} onChange={e => set('webServiceReverseProxyAddresses', e.target.value)} /></Field>
            <Field label="Real IP header"><input className="input w-full" value={f.webServiceRealIpHeader || ''} onChange={e => set('webServiceRealIpHeader', e.target.value)} /></Field>
          </div></Card>
          <Card><CardHead title="DNS listen endpoints" /><div className="space-y-3.5 p-5">
            <Field label="DNS listen endpoints (addr:port, one per line)"><textarea className="input min-h-[96px] w-full" value={toList(f.dnsServerLocalEndPoints)} onChange={e => set('dnsServerLocalEndPoints', e.target.value)} /></Field>
            <LockoutNote>Changing the DNS listen endpoints can stop the server answering on the addresses you rely on.</LockoutNote>
            <Field label="IPv4 source addresses (one per line)"><textarea className="input min-h-[64px] w-full" value={toList(f.dnsServerIPv4SourceAddresses)} onChange={e => set('dnsServerIPv4SourceAddresses', e.target.value)} /></Field>
            <Field label="IPv6 source addresses (one per line)"><textarea className="input min-h-[64px] w-full" value={toList(f.dnsServerIPv6SourceAddresses)} onChange={e => set('dnsServerIPv6SourceAddresses', e.target.value)} /></Field>
          </div></Card>
        </div>
      )}

      {tab === 'Optional Protocols' && (
        <Card><CardHead title="DNS-over-TLS / HTTPS / QUIC" /><div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-1">
            <TRow label="DNS-over-TLS" on={!!f.enableDnsOverTls} set={v => set('enableDnsOverTls', v)} />
            <TRow label="DNS-over-HTTPS" on={!!f.enableDnsOverHttps} set={v => set('enableDnsOverHttps', v)} />
            <TRow label="DNS-over-HTTP/3" on={!!f.enableDnsOverHttp3} set={v => set('enableDnsOverHttp3', v)} />
            <TRow label="DNS-over-QUIC" on={!!f.enableDnsOverQuic} set={v => set('enableDnsOverQuic', v)} />
            <TRow label="DNS-over-HTTP (plain, behind proxy)" on={!!f.enableDnsOverHttp} set={v => set('enableDnsOverHttp', v)} />
            <TRow label="DNS-over-UDP proxy (PROXY protocol)" on={!!f.enableDnsOverUdpProxy} set={v => set('enableDnsOverUdpProxy', v)} />
            <TRow label="DNS-over-TCP proxy (PROXY protocol)" on={!!f.enableDnsOverTcpProxy} set={v => set('enableDnsOverTcpProxy', v)} />
            <Field label="TLS certificate path"><input className="input mt-1 w-full" autoComplete="off" value={f.dnsTlsCertificatePath || ''} onChange={e => set('dnsTlsCertificatePath', e.target.value)} /></Field>
            <Field label="TLS certificate password"><input className="input w-full" type="password" autoComplete="new-password" value={f.dnsTlsCertificatePassword || ''} onChange={e => set('dnsTlsCertificatePassword', e.target.value)} /></Field>
          </div>
          <div className="space-y-3.5 self-start">
            <div className="grid grid-cols-2 gap-3">
              <Field label="DoT port"><input className="input w-full" type="number" value={f.dnsOverTlsPort} onChange={e => set('dnsOverTlsPort', +e.target.value)} /></Field>
              <Field label="DoH port"><input className="input w-full" type="number" value={f.dnsOverHttpsPort} onChange={e => set('dnsOverHttpsPort', +e.target.value)} /></Field>
              <Field label="DoQ port"><input className="input w-full" type="number" value={f.dnsOverQuicPort} onChange={e => set('dnsOverQuicPort', +e.target.value)} /></Field>
              <Field label="DoH (plain) port"><input className="input w-full" type="number" value={f.dnsOverHttpPort} onChange={e => set('dnsOverHttpPort', +e.target.value)} /></Field>
              <Field label="UDP proxy port"><input className="input w-full" type="number" value={f.dnsOverUdpProxyPort} onChange={e => set('dnsOverUdpProxyPort', +e.target.value)} /></Field>
              <Field label="TCP proxy port"><input className="input w-full" type="number" value={f.dnsOverTcpProxyPort} onChange={e => set('dnsOverTcpProxyPort', +e.target.value)} /></Field>
            </div>
            <Field label="Reverse proxy network ACL (one per line)"><textarea className="input min-h-[80px] w-full" value={toList(f.dnsReverseProxyNetworkACL)} onChange={e => set('dnsReverseProxyNetworkACL', e.target.value)} /></Field>
            <Field label="DoH real IP header"><input className="input w-full" value={f.dnsOverHttpRealIpHeader || ''} onChange={e => set('dnsOverHttpRealIpHeader', e.target.value)} /></Field>
          </div>
        </div></Card>
      )}

      {tab === 'Proxy & Forwarders' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardHead title="Forwarders" /><div className="space-y-3.5 p-5">
            <Field label="Protocol"><select className="input w-full" value={f.forwarderProtocol} onChange={e => set('forwarderProtocol', e.target.value)}>{FWD_PROTO.map(p => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Forwarders (one per line)"><textarea className="input min-h-[96px] w-full" value={toList(f.forwarders)} onChange={e => set('forwarders', e.target.value)} /></Field>
            <TRow label="Concurrent forwarding" on={!!f.concurrentForwarding} set={v => set('concurrentForwarding', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Retries"><input className="input w-full" type="number" value={f.forwarderRetries} onChange={e => set('forwarderRetries', +e.target.value)} /></Field>
              <Field label="Timeout (ms)"><input className="input w-full" type="number" value={f.forwarderTimeout} onChange={e => set('forwarderTimeout', +e.target.value)} /></Field>
            </div>
          </div></Card>
          <Card><CardHead title="Proxy" /><div className="space-y-3.5 p-5">
            <Field label="Proxy type"><select className="input w-full" value={f.proxyType || 'None'} onChange={e => set('proxyType', e.target.value)}>{PROXY_TYPE.map(p => <option key={p}>{p}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Address"><input className="input w-full" value={f.proxyAddress || ''} onChange={e => set('proxyAddress', e.target.value)} /></Field>
              <Field label="Port"><input className="input w-full" type="number" value={f.proxyPort || ''} onChange={e => set('proxyPort', +e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username"><input className="input w-full" value={f.proxyUsername || ''} onChange={e => set('proxyUsername', e.target.value)} /></Field>
              <Field label="Password"><input className="input w-full" type="password" autoComplete="new-password" value={f.proxyPassword || ''} onChange={e => set('proxyPassword', e.target.value)} /></Field>
            </div>
          </div></Card>
        </div>
      )}

      {tab === 'Recursion' && (
        <Card><CardHead title="Recursion & resolver" /><div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-1">
            <Field label="Recursion"><select className="input mb-2 w-full" value={f.recursion} onChange={e => set('recursion', e.target.value)}>{RECURSION.map(r => <option key={r}>{r}</option>)}</select></Field>
            <TRow label="Randomize name (0x20)" on={!!f.randomizeName} set={v => set('randomizeName', v)} />
            <TRow label="QNAME minimization" on={!!f.qnameMinimization} set={v => set('qnameMinimization', v)} />
            <RO label="Recursion network ACL (read-only)" value={toList(f.recursionNetworkACL).replace(/\n/g, ', ')} />
          </div>
          <div className="grid grid-cols-2 gap-3 self-start">
            <Field label="Resolver retries"><input className="input w-full" type="number" value={f.resolverRetries} onChange={e => set('resolverRetries', +e.target.value)} /></Field>
            <Field label="Resolver timeout (ms)"><input className="input w-full" type="number" value={f.resolverTimeout} onChange={e => set('resolverTimeout', +e.target.value)} /></Field>
            <Field label="Concurrency"><input className="input w-full" type="number" value={f.resolverConcurrency} onChange={e => set('resolverConcurrency', +e.target.value)} /></Field>
            <Field label="Max stack count"><input className="input w-full" type="number" value={f.resolverMaxStackCount} onChange={e => set('resolverMaxStackCount', +e.target.value)} /></Field>
          </div>
        </div></Card>
      )}

      {tab === 'Blocking' && (
        <Card><CardHead title="Ad / tracker blocking" /><div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-1">
            <TRow label="Enable blocking" on={!!f.enableBlocking} set={v => set('enableBlocking', v)} />
            <TRow label="Allow TXT blocking report" on={!!f.allowTxtBlockingReport} set={v => set('allowTxtBlockingReport', v)} />
            <Field label="Block response"><select className="input mt-1 w-full" value={f.blockingType} onChange={e => set('blockingType', e.target.value)}>{BLOCK_TYPE.map(b => <option key={b}>{b}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field label="Answer TTL"><input className="input w-full" type="number" value={f.blockingAnswerTtl} onChange={e => set('blockingAnswerTtl', +e.target.value)} /></Field>
              <Field label="Update interval (h)"><input className="input w-full" type="number" value={f.blockListUpdateIntervalHours} onChange={e => set('blockListUpdateIntervalHours', +e.target.value)} /></Field>
            </div>
            <Field label="Bypass list (one per line)"><textarea className="input min-h-[80px] w-full" value={toList(f.blockingBypassList)} onChange={e => set('blockingBypassList', e.target.value)} /></Field>
          </div>
          <Field label="Block-list URLs (one per line)"><textarea className="input min-h-[260px] w-full" value={toList(f.blockListUrls)} onChange={e => set('blockListUrls', e.target.value)} /></Field>
        </div></Card>
      )}

      {tab === 'TSIG' && (
        <Card>
          <CardHead title={`TSIG keys · ${(f.tsigKeys || []).length}`}
            right={<button className="btn-ghost !py-1.5 text-xs" onClick={() => set('tsigKeys', [...(f.tsigKeys || []), { keyName: '', sharedSecret: '', algorithmName: 'hmac-sha256' }])}><Plus size={14} /> Add key</button>} />
          <div className="space-y-3 p-5">
            {(f.tsigKeys || []).length === 0 ? <div className="py-6 text-center text-sm text-mut">No TSIG keys.</div> :
              (f.tsigKeys || []).map((k: any, i: number) => (
                <div key={i} className="grid grid-cols-[1fr_1.4fr_150px_36px] items-center gap-2">
                  <input className="input" placeholder="key name" value={k.keyName} onChange={e => { const a = [...f.tsigKeys]; a[i] = { ...a[i], keyName: e.target.value }; set('tsigKeys', a) }} />
                  <input className="input font-mono !text-[11px]" placeholder="shared secret (base64)" value={k.sharedSecret} onChange={e => { const a = [...f.tsigKeys]; a[i] = { ...a[i], sharedSecret: e.target.value }; set('tsigKeys', a) }} />
                  <select className="input" value={k.algorithmName} onChange={e => { const a = [...f.tsigKeys]; a[i] = { ...a[i], algorithmName: e.target.value }; set('tsigKeys', a) }}>{TSIG_ALGO.map(al => <option key={al}>{al}</option>)}</select>
                  <button onClick={() => set('tsigKeys', f.tsigKeys.filter((_: any, j: number) => j !== i))} className="rounded-md p-2 text-mut hover:bg-bad/15 hover:text-bad"><Trash2 size={14} /></button>
                </div>
              ))}
            <p className="pt-1 text-xs text-mut">Used for authenticated zone transfers & cluster sync. Removing the cluster key breaks cluster sync.</p>
          </div>
        </Card>
      )}

      {tab === 'Backup & Restore' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardHead title="Backup" /><div className="space-y-1 p-5">
            <p className="pb-1 text-xs text-mut">Pick the items to include, then download a zip archive of the current configuration.</p>
            {BACKUP_ITEMS.map(it => (
              <CheckRow key={it.k} label={it.label} on={!!backupFlags[it.k]} set={v => setBackupFlags(s => ({ ...s, [it.k]: v }))} />
            ))}
            <div className="pt-3">
              <button className="btn-primary" onClick={downloadBackup}><Download size={15} /> Download backup</button>
            </div>
          </div></Card>
          <Card><CardHead title="Restore" /><div className="space-y-1 p-5">
            <Field label="Backup zip file">
              <input className="input w-full" type="file" accept=".zip" onChange={e => setRestoreFile(e.target.files?.[0] || null)} />
            </Field>
            <p className="pb-1 pt-2 text-xs text-mut">Select which items to restore from the archive.</p>
            {BACKUP_ITEMS.map(it => (
              <CheckRow key={it.k} label={it.label} on={!!restoreFlags[it.k]} set={v => setRestoreFlags(s => ({ ...s, [it.k]: v }))} />
            ))}
            <div className="pt-1">
              <TRow label="Delete existing files for selected items" on={deleteExisting} set={setDeleteExisting} />
            </div>
            <LockoutNote>Restoring overwrites the selected configuration and may restart services. Make sure you have a current backup first.</LockoutNote>
            <div className="pt-3">
              <button className="btn-primary !bg-none !bg-bad/90 !text-white !shadow-none" disabled={!restoreFile || restoring} onClick={doRestore}><Upload size={15} /> {restoring ? 'Restoring…' : 'Restore'}</button>
            </div>
          </div></Card>
        </div>
      )}
    </div>
  )
}
