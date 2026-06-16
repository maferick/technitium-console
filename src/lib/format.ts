// Wording + formatting. This is where stock Technitium's terse/technical
// labels get humanised, and where display sorting lives.

export const num = (n: number) => (n ?? 0).toLocaleString('en-US')
export const pct = (n: number, total: number) => (total > 0 ? `${((100 * n) / total).toFixed(1)}%` : '0%')

export function relTime(iso: string): string {
  const d = new Date(iso).getTime()
  const s = Math.max(0, Math.round((Date.now() - d) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
export const timeAbs = (iso: string) => new Date(iso).toLocaleString('en-GB', { hour12: false })

// A client comes back as { name: ip, domain: hostname }. Prefer a clean hostname.
export function clientName(item: { name: string; domain?: string }) {
  const host = item.domain?.replace(/\.(fritz\.box|lan|local)\.?$/i, '').replace(/\.$/, '')
  return { primary: host || item.name, secondary: host ? item.name : '' }
}

// responseType: how the answer was produced
const RESP: Record<string, { label: string; cls: string }> = {
  Authoritative: { label: 'Local zone', cls: 'text-olive bg-olive/10' },
  Recursive: { label: 'Resolved', cls: 'text-cyan bg-cyan/10' },
  Cached: { label: 'Cached', cls: 'text-violet bg-violet/10' },
  Blocked: { label: 'Blocked', cls: 'text-warn bg-warn/10' },
  Dropped: { label: 'Dropped', cls: 'text-mut bg-white/5' },
  UpstreamBlocked: { label: 'Blocked (upstream)', cls: 'text-warn bg-warn/10' },
  CacheBlocked: { label: 'Blocked (cached)', cls: 'text-warn bg-warn/10' },
}
export const respMeta = (t: string) => RESP[t] || { label: t, cls: 'text-dim bg-white/5' }

// rcode: the DNS result code
const RCODE: Record<string, { label: string; cls: string }> = {
  NoError: { label: 'OK', cls: 'text-ok bg-ok/10' },
  NxDomain: { label: 'Not found', cls: 'text-mut bg-white/5' },
  ServerFailure: { label: 'Server error', cls: 'text-bad bg-bad/10' },
  ServFail: { label: 'Server error', cls: 'text-bad bg-bad/10' },
  Refused: { label: 'Refused', cls: 'text-cyan bg-cyan/10' },
  FormatError: { label: 'Bad query', cls: 'text-bad bg-bad/10' },
}
export const rcodeMeta = (t: string) => RCODE[t] || { label: t, cls: 'text-dim bg-white/5' }

export const qtypeCls = (q: string) =>
  q === 'A' ? 'text-accent bg-accent/10' :
  q === 'AAAA' ? 'text-mut bg-white/5' :
  q === 'HTTPS' || q === 'SVCB' ? 'text-teal bg-teal/10' :
  q === 'PTR' ? 'text-violet bg-violet/10' :
  'text-dim bg-white/5'

// dashboard tiles: ordered + relabelled, with accent colour per metric
export const STAT_TILES = [
  { key: 'totalQueries', label: 'Queries', color: '#a3e635' },
  { key: 'totalNoError', label: 'Successful', color: '#34d399' },
  { key: 'totalServerFailure', label: 'Failures', color: '#fb7185' },
  { key: 'totalNxDomain', label: 'Not found', color: '#94a3b8' },
  { key: 'totalBlocked', label: 'Blocked', color: '#fbbf24' },
  { key: 'totalCached', label: 'Cached', color: '#a78bfa' },
  { key: 'totalRecursive', label: 'Resolved', color: '#2dd4bf' },
  { key: 'totalClients', label: 'Clients', color: '#60a5fa' },
] as const
