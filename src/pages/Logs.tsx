import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Download, Trash2, X } from 'lucide-react'
import { getLogFiles, logDownloadUrl, deleteLog } from '../lib/api'
import { Card, CardHead, Spinner, Empty, toast } from '../components/ui'

export default function Logs() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['logfiles'], queryFn: getLogFiles })
  const [view, setView] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [loadingText, setLoadingText] = useState(false)

  const open = async (f: string) => {
    setView(f); setText(''); setLoadingText(true)
    try { const r = await fetch(logDownloadUrl(f)); setText(await r.text()) }
    catch { setText('Failed to load log.') } finally { setLoadingText(false) }
  }
  const del = async (f: string) => {
    if (!confirm(`Delete log ${f}?`)) return
    try { await deleteLog(f); toast('Log deleted'); qc.invalidateQueries({ queryKey: ['logfiles'] }) }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">Logs</h1>
      <Card>
        <CardHead title={`Diagnostic log files · ${data?.length || 0}`} />
        {isLoading ? <Spinner /> : !data || data.length === 0 ? <Empty>No log files.</Empty> :
          <div className="p-1.5">
            {data.map(f => (
              <div key={f.fileName} className="group flex items-center justify-between rounded-lg px-4 py-2.5 transition hover:bg-white/5">
                <button onClick={() => open(f.fileName)} className="flex items-center gap-2.5 font-mono text-[13px] text-dim hover:text-white">
                  <FileText size={14} className="text-mut" />{f.fileName}<span className="text-mut">· {f.size}</span>
                </button>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <a href={logDownloadUrl(f.fileName)} download className="rounded-md p-1.5 text-mut hover:bg-white/10 hover:text-white"><Download size={14} /></a>
                  <button onClick={() => del(f.fileName)} className="rounded-md p-1.5 text-mut hover:bg-bad/15 hover:text-bad"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>}
      </Card>

      {view && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm" onClick={() => setView(null)}>
          <div className="card flex h-[80vh] w-full max-w-4xl flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h3 className="font-mono text-sm font-bold">{view}</h3>
              <button onClick={() => setView(null)} className="text-mut hover:text-white"><X size={18} /></button>
            </div>
            <pre className="flex-1 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-dim">{loadingText ? 'Loading…' : text}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
