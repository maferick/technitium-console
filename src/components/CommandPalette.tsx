import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ScrollText, Globe, Shield, Search, Network, FolderTree, Database, Blocks, ListFilter, Settings as Cog, Boxes, UserCog, FileText, Info, LogOut, CornerDownLeft,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

type Cmd = { id: string; label: string; hint: string; icon: any; run: (n: ReturnType<typeof useNavigate>, signOut: () => void) => void }

const CMDS: Cmd[] = [
  { id: 'dash', label: 'Dashboard', hint: 'Overview', icon: LayoutDashboard, run: n => n('/') },
  { id: 'logs', label: 'Query Log', hint: 'Search queries', icon: ScrollText, run: n => n('/logs') },
  { id: 'lookup', label: 'DNS Lookup', hint: 'Resolve a domain', icon: Search, run: n => n('/lookup') },
  { id: 'clients', label: 'Clients', hint: 'Active devices', icon: Globe, run: n => n('/clients') },
  { id: 'dhcp', label: 'DHCP Leases', hint: 'Address assignments', icon: Network, run: n => n('/dhcp') },
  { id: 'zones', label: 'Zones', hint: 'Authoritative zones', icon: FolderTree, run: n => n('/zones') },
  { id: 'cache', label: 'Cache', hint: 'Browse resolver cache', icon: Database, run: n => n('/cache') },
  { id: 'lists', label: 'Allow / Block lists', hint: 'Manage domains', icon: ListFilter, run: n => n('/lists') },
  { id: 'blocking', label: 'Blocking', hint: 'Blocked domains', icon: Shield, run: n => n('/blocking') },
  { id: 'apps', label: 'DNS Apps', hint: 'Installed apps', icon: Blocks, run: n => n('/apps') },
  { id: 'settings', label: 'Settings', hint: 'Resolver config', icon: Cog, run: n => n('/settings') },
  { id: 'cluster', label: 'Cluster', hint: 'Node status', icon: Boxes, run: n => n('/cluster') },
  { id: 'admin', label: 'Administration', hint: 'Sessions, users, permissions', icon: UserCog, run: n => n('/admin') },
  { id: 'logfiles', label: 'Logs', hint: 'Diagnostic log files', icon: FileText, run: n => n('/logfiles') },
  { id: 'about', label: 'About', hint: 'Version & info', icon: Info, run: n => n('/about') },
  { id: 'logout', label: 'Sign out', hint: 'End session', icon: LogOut, run: (_n, so) => so() },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const nav = useNavigate()
  const { signOut } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    const openEv = () => setOpen(true)
    window.addEventListener('keydown', on); window.addEventListener('tdns-cmdk', openEv)
    return () => { window.removeEventListener('keydown', on); window.removeEventListener('tdns-cmdk', openEv) }
  }, [])
  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => inputRef.current?.focus(), 10) } }, [open])

  const list = useMemo(() => CMDS.filter(c => (c.label + c.hint).toLowerCase().includes(q.toLowerCase())), [q])
  useEffect(() => { setI(0) }, [q])
  if (!open) return null

  const choose = (c?: Cmd) => { if (!c) return; setOpen(false); c.run(nav, () => { signOut().then(() => nav('/login')) }) }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 pt-[14vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line2 bg-surface shadow-card" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="text-mut" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Jump to…"
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI(p => Math.min(p + 1, list.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI(p => Math.max(p - 1, 0)) }
              if (e.key === 'Enter') { e.preventDefault(); choose(list[i]) }
            }}
            className="w-full bg-transparent py-3.5 text-sm text-txt outline-none placeholder:text-mut" />
          <kbd className="rounded border border-line2 px-1.5 py-0.5 font-mono text-[10px] text-mut">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {list.length === 0 ? <div className="px-3 py-6 text-center text-sm text-mut">No matches</div> :
            list.map((c, idx) => (
              <button key={c.id} onMouseEnter={() => setI(idx)} onClick={() => choose(c)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${idx === i ? 'bg-accent/15 text-white' : 'text-dim hover:bg-white/5'}`}>
                <c.icon size={16} className={idx === i ? 'text-accent' : 'text-mut'} />
                <span className="text-[13.5px] font-medium">{c.label}</span>
                <span className="text-xs text-mut">{c.hint}</span>
                {idx === i && <CornerDownLeft size={13} className="ml-auto text-mut" />}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
