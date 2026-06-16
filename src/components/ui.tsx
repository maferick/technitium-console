import { ReactNode, useEffect, useRef, useState } from 'react'
import { X, MoreVertical } from 'lucide-react'

// kebab dropdown menu (row quick-actions, etc.)
export interface MenuItem { label: string; onClick: () => void; danger?: boolean }
export function Menu({ items, label, align = 'right' }: { items: MenuItem[]; label?: string; align?: 'right' | 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const on = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', on); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', on); window.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      {label
        ? <button onClick={() => setOpen(o => !o)} className="btn-ghost !py-1.5 text-xs">{label}</button>
        : <button onClick={() => setOpen(o => !o)} className="rounded-md p-1.5 text-mut transition hover:bg-white/10 hover:text-white"><MoreVertical size={15} /></button>}
      {open && (
        <div className={`absolute z-50 mt-1 min-w-[170px] overflow-hidden rounded-lg border border-line2 bg-surface2 py-1 shadow-card ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((it, i) => (
            <button key={i} onClick={() => { setOpen(false); it.onClick() }}
              className={`block w-full px-3.5 py-2 text-left text-[13px] transition hover:bg-surface3 ${it.danger ? 'text-bad hover:text-bad' : 'text-dim hover:text-white'}`}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`card w-full ${wide ? 'max-w-lg' : 'max-w-md'} animate-fadeUp`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-mut transition hover:text-white"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-mut">{label}</span>
    {children}
  </label>
)

export const Skeleton = ({ className = '' }: { className?: string }) =>
  <div className={`animate-pulse rounded-lg bg-surface2 ${className}`} />

// ---- tiny toast system ----
type Toast = { id: number; msg: string; kind: 'ok' | 'err' }
export function toast(msg: string, kind: 'ok' | 'err' = 'ok') {
  window.dispatchEvent(new CustomEvent('tdns-toast', { detail: { id: Date.now() + Math.floor(performance.now()), msg, kind } }))
}
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const on = (e: any) => {
      const t = e.detail as Toast
      setItems(s => [...s, t])
      setTimeout(() => setItems(s => s.filter(x => x.id !== t.id)), 3200)
    }
    window.addEventListener('tdns-toast', on)
    return () => window.removeEventListener('tdns-toast', on)
  }, [])
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
      {items.map(t => (
        <div key={t.id} className={`animate-fadeUp rounded-xl border px-4 py-2.5 text-sm font-medium shadow-card backdrop-blur-xl ${
          t.kind === 'ok' ? 'border-ok/30 bg-ok/10 text-ok' : 'border-bad/30 bg-bad/10 text-bad'}`}>{t.msg}</div>
      ))}
    </div>
  )
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`card ${className}`}>{children}</div>

export const CardHead = ({ title, right }: { title: string; right?: ReactNode }) => (
  <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
    <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
    {right}
  </div>
)

export const Chip = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <span className={`chip ${className}`}>{children}</span>

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-mut">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line2 border-t-accent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) =>
  <div className="py-10 text-center text-sm text-mut">{children}</div>

// horizontal "rank" rows used by Top lists
export function RankRow({ primary, secondary, value, max, action }: { primary: string; secondary?: string; value: number; max: number; action?: ReactNode }) {
  const w = max > 0 ? Math.max(3, (100 * value) / max) : 0
  return (
    <div className="group relative flex items-center justify-between gap-3 px-5 py-2.5">
      <div className="absolute inset-y-1 left-0 rounded-r-md bg-accent/[0.07] transition-all" style={{ width: `${w}%` }} />
      <div className="relative min-w-0">
        <div className="truncate font-mono text-[13px] text-txt">{primary}</div>
        {secondary && <div className="truncate font-mono text-[11px] text-mut">{secondary}</div>}
      </div>
      <div className="relative flex items-center gap-1">
        <div className="font-mono text-[13px] font-semibold text-dim tabular-nums">{value.toLocaleString()}</div>
        {action}
      </div>
    </div>
  )
}
