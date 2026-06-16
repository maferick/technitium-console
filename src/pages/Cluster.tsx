import { useQuery } from '@tanstack/react-query'
import { Boxes } from 'lucide-react'
import { getCluster } from '../lib/api'
import { relTime, timeAbs } from '../lib/format'
import { Card, CardHead, Chip, Spinner, Empty } from '../components/ui'

export default function Cluster() {
  const { data, isLoading } = useQuery({ queryKey: ['cluster'], queryFn: getCluster, refetchInterval: 15_000 })
  if (isLoading || !data) return <Spinner label="Loading…" />

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight"><Boxes size={20} className="text-accent" /> Cluster</h1>
      {!data.clusterInitialized ?
        <Card><Empty>Clustering is not initialized on this server.</Empty></Card> :
        <Card>
          <CardHead title={`Domain · ${data.clusterDomain}`} right={<Chip className="text-ok bg-ok/10">{data.clusterNodes.length} nodes</Chip>} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
                <th className="px-5 py-3">Node</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">State</th><th className="px-5 py-3">Last seen</th>
              </tr></thead>
              <tbody>
                {data.clusterNodes.map((n, i) => {
                  const up = n.state === 'Connected' || n.state === 'Self'
                  return (
                    <tr key={i} className="border-t border-line hover:bg-surface2">
                      <td className="px-5 py-3 font-mono text-[13px] text-txt">
                        <span className={`mr-2 inline-block h-2 w-2 rounded-full ${up ? 'bg-ok shadow-[0_0_8px_#34d399]' : 'bg-bad'}`} />{n.name}
                      </td>
                      <td className="px-5 py-3"><Chip className={n.type === 'Primary' ? 'text-accent bg-accent/10' : 'text-violet bg-violet/10'}>{n.type}</Chip></td>
                      <td className="px-5 py-3"><Chip className={up ? 'text-ok bg-ok/10' : 'text-bad bg-bad/10'}>{n.state}</Chip></td>
                      <td className="px-5 py-3 font-mono text-xs text-mut" title={n.lastSeen ? timeAbs(n.lastSeen) : ''}>{n.state === 'Self' ? 'this node' : n.lastSeen ? relTime(n.lastSeen) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>}
    </div>
  )
}
