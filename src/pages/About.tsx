import { Server, Github, BookOpen, Boxes } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Card } from '../components/ui'

export default function About() {
  const { info } = useAuth()
  const rows = [
    ['Version', info?.version ? `Technitium DNS Server v${info.version}` : '—'],
    ['Server domain', info?.dnsServerDomain || '—'],
    ['Clustering', info?.clusterInitialized ? `enabled · ${info?.clusterNodes?.length ?? 0} nodes` : 'standalone'],
  ]
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">About</h1>
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent shadow-glow"><Server size={26} /></div>
          <div>
            <div className="bg-gradient-to-r from-white to-[#d9f99d] bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">DNS Console</div>
            <div className="font-mono text-xs text-mut">a modern front-end for Technitium DNS Server</div>
          </div>
        </div>
        <div className="mt-6 divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-3">
              <span className="text-sm text-dim">{k}</span><span className="font-mono text-[13px] text-txt">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="https://github.com/TechnitiumSoftware/DnsServer" target="_blank" className="btn-ghost"><Github size={15} /> Technitium</a>
          <a href="https://blog.technitium.com/" target="_blank" className="btn-ghost"><BookOpen size={15} /> Docs</a>
          <a href="https://github.com/maferick/technitium-console" target="_blank" className="btn-ghost"><Boxes size={15} /> This UI</a>
        </div>
      </Card>
    </div>
  )
}
