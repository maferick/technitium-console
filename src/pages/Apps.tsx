import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Download, RefreshCw, Trash2, Settings2 } from 'lucide-react'
import { getApps, getStoreApps, installApp, updateApp, uninstallApp, getAppConfig, setAppConfig } from '../lib/api'
import { Card, CardHead, Chip, Spinner, Modal, toast } from '../components/ui'

export default function Apps() {
  const qc = useQueryClient()
  const installed = useQuery({ queryKey: ['apps'], queryFn: getApps })
  const store = useQuery({ queryKey: ['storeApps'], queryFn: getStoreApps })
  const [cfgApp, setCfgApp] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const refresh = () => { qc.invalidateQueries({ queryKey: ['apps'] }); qc.invalidateQueries({ queryKey: ['storeApps'] }) }

  if (installed.isLoading || store.isLoading || !store.data) return <Spinner label="Loading apps…" />
  const inst = new Map((installed.data || []).map(a => [a.name, a.version]))
  const run = async (name: string, fn: Promise<any>, msg: string) => {
    setBusy(name); try { await fn; toast(msg); refresh() } catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy('') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">DNS Apps</h1>
        <span className="font-mono text-xs text-mut">{inst.size} installed · {store.data.length} in store</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {store.data.map(a => {
          const cur = inst.get(a.name)
          const upd = cur && cur !== a.version
          const isBusy = busy === a.name
          return (
            <Card key={a.name} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 font-semibold text-txt"><Boxes size={17} className="text-accent" />{a.name}</div>
                {cur ? <Chip className="text-ok bg-ok/10">installed v{cur}</Chip> : <Chip className="text-mut bg-white/5">v{a.version}</Chip>}
              </div>
              <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-mut">{a.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                {!cur && <button disabled={!!busy} onClick={() => run(a.name, installApp(a.name, a.url), `Installed ${a.name}`)} className="btn-primary !py-1.5 text-xs">{isBusy ? 'Installing…' : <><Download size={13} /> Install</>}</button>}
                {upd && <button disabled={!!busy} onClick={() => run(a.name, updateApp(a.name, a.url), `Updated ${a.name}`)} className="btn-ghost !py-1.5 text-xs !text-accent"><RefreshCw size={13} /> Update to v{a.version}</button>}
                {cur && <button onClick={() => setCfgApp(a.name)} className="btn-ghost !py-1.5 text-xs"><Settings2 size={13} /> Config</button>}
                {cur && <button disabled={!!busy} onClick={() => confirm(`Uninstall ${a.name}?`) && run(a.name, uninstallApp(a.name), `Uninstalled ${a.name}`)} className="btn-ghost ml-auto !py-1.5 text-xs !text-bad hover:!bg-bad/10"><Trash2 size={13} /></button>}
              </div>
            </Card>
          )
        })}
      </div>
      {cfgApp && <AppConfig name={cfgApp} onClose={() => setCfgApp(null)} />}
    </div>
  )
}

function AppConfig({ name, onClose }: { name: string; onClose: () => void }) {
  const [cfg, setCfg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useQuery({ queryKey: ['appcfg', name], queryFn: () => getAppConfig(name).then(c => { setCfg(c || ''); return c }) })
  const save = async () => {
    setBusy(true)
    try { await setAppConfig(name, cfg || ''); toast('Config saved'); onClose() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} wide title={`Configure · ${name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || cfg === null} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></>}>
      {cfg === null ? <Spinner /> :
        <textarea className="input min-h-[300px] w-full font-mono !text-[12px]" value={cfg} onChange={e => setCfg(e.target.value)} spellCheck={false} />}
    </Modal>
  )
}
