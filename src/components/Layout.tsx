import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ScrollText, Search, Globe, Network, FolderTree, Database, Blocks, Shield, ListFilter, Settings as Cog, Boxes, UserCog, FileText, Info, LogOut, Server, Command,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import CommandPalette from './CommandPalette'
import { Toaster } from './ui'

const NAV = [
  { group: 'Monitor', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/logs', label: 'Query Log', icon: ScrollText },
    { to: '/lookup', label: 'DNS Lookup', icon: Search },
    { to: '/clients', label: 'Clients', icon: Globe },
  ]},
  { group: 'Manage', items: [
    { to: '/dhcp', label: 'DHCP Leases', icon: Network },
    { to: '/zones', label: 'Zones', icon: FolderTree },
    { to: '/cache', label: 'Cache', icon: Database },
    { to: '/lists', label: 'Allow / Block', icon: ListFilter },
    { to: '/blocking', label: 'Blocking', icon: Shield },
    { to: '/apps', label: 'DNS Apps', icon: Blocks },
    { to: '/settings', label: 'Settings', icon: Cog },
  ]},
  { group: 'System', items: [
    { to: '/cluster', label: 'Cluster', icon: Boxes },
    { to: '/admin', label: 'Administration', icon: UserCog },
    { to: '/logfiles', label: 'Logs', icon: FileText },
    { to: '/about', label: 'About', icon: Info },
  ]},
]

export default function Layout() {
  const { info, signOut } = useAuth()
  const nav = useNavigate()
  const doLogout = async () => { await signOut(); nav('/login') }

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/70 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent shadow-glow"><Server size={16} /></div>
          <span className="bg-gradient-to-r from-white to-[#d9f99d] bg-clip-text text-[17px] font-extrabold tracking-tight text-transparent">DNS Console</span>
          {info?.dnsServerDomain && <span className="ml-1 hidden font-mono text-xs text-mut sm:inline">· {info.dnsServerDomain}</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.dispatchEvent(new Event('tdns-cmdk'))}
            className="hidden items-center gap-2 rounded-lg border border-line2 bg-surface2 px-2.5 py-1.5 text-xs text-mut transition hover:text-txt sm:flex">
            <Command size={13} /> Search <kbd className="rounded border border-line2 px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
          {info?.version && <span className="hidden font-mono text-[11px] text-mut md:inline">v{info.version}</span>}
          <button onClick={doLogout} className="btn-ghost !px-2.5 !py-1.5 text-xs"><LogOut size={14} /> Sign out</button>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col gap-3 overflow-y-auto border-r border-line bg-gradient-to-b from-surface/90 to-bg/90 px-3 pb-4 pt-[68px] backdrop-blur-xl md:flex">
        {NAV.map(sec => (
          <div key={sec.group}>
            <div className="px-3 pb-2 pt-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-mut">{sec.group.toUpperCase()}</div>
            <nav className="flex flex-col gap-1">
              {sec.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={(end as boolean) || undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition ${
                      isActive ? 'bg-gradient-to-r from-accent/15 to-accent/[0.04] text-white shadow-[inset_3px_0_0_#a3e635]'
                               : 'text-dim hover:bg-white/5 hover:text-white'}`}>
                  {({ isActive }) => (<><Icon size={16} className={isActive ? 'text-accent' : 'text-mut'} /> {label}</>)}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
        <div className="mt-auto px-3 pt-2 font-mono text-[10px] text-mut">
          {info?.clusterInitialized ? `● cluster · ${info.clusterNodes?.length ?? 0} nodes` : '○ standalone'}
        </div>
      </aside>

      <main className="px-5 pb-14 pt-[72px] md:pl-[264px] md:pr-9"><Outlet /></main>
      <CommandPalette />
      <Toaster />
    </div>
  )
}
