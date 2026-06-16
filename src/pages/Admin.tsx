import { useState, Fragment } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, ShieldCheck, Check, X, Plus, KeyRound, Power } from 'lucide-react'
import {
  getSessions, deleteSession, getUsers, getGroups, getPermissions, setPermissions,
  createUser, setUserDisabled, setUserPassword, deleteUser, createGroup, deleteGroup, getSso, setSso,
  createApiToken,
} from '../lib/api'
import { relTime, timeAbs } from '../lib/format'
import { Card, CardHead, Chip, Spinner, Empty, Modal, Field, toast } from '../components/ui'

const TABS = ['Sessions', 'Users', 'Groups', 'Permissions', 'Single Sign-On'] as const
type Tab = typeof TABS[number]

export default function Admin() {
  const [tab, setTab] = useState<Tab>('Sessions')
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight">Administration</h1>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition ${tab === t ? 'bg-surface3 text-accent shadow-[0_1px_0_rgba(255,255,255,.05)_inset]' : 'text-dim hover:text-white'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Sessions' && <Sessions />}
      {tab === 'Users' && <Users />}
      {tab === 'Groups' && <Groups />}
      {tab === 'Permissions' && <Permissions />}
      {tab === 'Single Sign-On' && <Sso />}
    </div>
  )
}

function Sso() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['sso'], queryFn: getSso })
  const [f, setF] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  if (isLoading) return <Spinner />
  const cur = f || data || {}
  const set = (k: string, v: any) => setF({ ...cur, [k]: v })
  const save = async () => {
    setBusy(true)
    try {
      await setSso({
        ssoEnabled: !!cur.ssoEnabled, ssoAuthority: cur.ssoAuthority || '', ssoClientId: cur.ssoClientId || '',
        ssoClientSecret: cur.ssoClientSecret || '', ssoMetadataAddress: cur.ssoMetadataAddress || '',
        ssoScopes: Array.isArray(cur.ssoScopes) ? cur.ssoScopes.join(',') : (cur.ssoScopes || 'openid,profile,email'),
        ssoAllowSignup: !!cur.ssoAllowSignup,
      })
      toast('SSO settings saved'); setF(null); qc.invalidateQueries({ queryKey: ['sso'] })
    } catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  const scopes = Array.isArray(cur.ssoScopes) ? cur.ssoScopes.join(', ') : (cur.ssoScopes || '')
  return (
    <Card>
      <CardHead title="OpenID Connect (SSO)" right={<button className="btn-primary !py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>} />
      <div className="space-y-3.5 p-5">
        <div className="flex items-center justify-between py-1"><span className="text-sm text-dim">Enable SSO</span>
          <button onClick={() => set('ssoEnabled', !cur.ssoEnabled)} className={`relative h-6 w-11 rounded-full transition ${cur.ssoEnabled ? 'bg-accent' : 'bg-surface3'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${cur.ssoEnabled ? 'left-[22px]' : 'left-0.5'}`} /></button>
        </div>
        <Field label="Authority URL"><input className="input w-full" placeholder="https://idp.example.com" value={cur.ssoAuthority || ''} onChange={e => set('ssoAuthority', e.target.value)} /></Field>
        <Field label="Metadata address"><input className="input w-full" placeholder="https://idp.example.com/.well-known/openid-configuration" value={cur.ssoMetadataAddress || ''} onChange={e => set('ssoMetadataAddress', e.target.value)} /></Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Client ID"><input className="input w-full" value={cur.ssoClientId || ''} onChange={e => set('ssoClientId', e.target.value)} /></Field>
          <Field label="Client secret"><input className="input w-full" type="password" autoComplete="new-password" value={cur.ssoClientSecret || ''} onChange={e => set('ssoClientSecret', e.target.value)} /></Field>
        </div>
        <Field label="Scopes (comma-separated)"><input className="input w-full" value={scopes} onChange={e => set('ssoScopes', e.target.value.split(',').map(s => s.trim()))} /></Field>
        <div className="flex items-center justify-between py-1"><span className="text-sm text-dim">Allow self-signup</span>
          <button onClick={() => set('ssoAllowSignup', !cur.ssoAllowSignup)} className={`relative h-6 w-11 rounded-full transition ${cur.ssoAllowSignup ? 'bg-accent' : 'bg-surface3'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${cur.ssoAllowSignup ? 'left-[22px]' : 'left-0.5'}`} /></button>
        </div>
      </div>
    </Card>
  )
}

function Sessions() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['sessions'], queryFn: getSessions, refetchInterval: 15_000 })
  const [creating, setCreating] = useState(false)
  const revoke = async (s: any) => {
    if (s.isCurrentSession || !confirm(`Revoke ${s.username}'s session?`)) return
    try { await deleteSession(s.partialToken); toast('Session revoked'); qc.invalidateQueries({ queryKey: ['sessions'] }) }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }
  if (isLoading || !data) return <Spinner />
  return (
    <Card>
      <CardHead title={`Active sessions · ${data.length}`} right={<button className="btn-primary !py-1.5 text-xs" onClick={() => setCreating(true)}><KeyRound size={14} /> New API token</button>} />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
            <th className="px-5 py-3">User</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">From</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Last seen</th><th className="px-5 py-3"></th>
          </tr></thead>
          <tbody>
            {data.map((s, i) => (
              <tr key={i} className="group border-t border-line hover:bg-surface2">
                <td className="px-5 py-3 font-mono text-[13px] text-txt">{s.username}{s.isCurrentSession && <Chip className="ml-2 text-accent bg-accent/10">this session</Chip>}</td>
                <td className="px-5 py-3"><Chip className="text-dim bg-white/5">{s.tokenName || s.type}</Chip></td>
                <td className="px-5 py-3 font-mono text-[13px] text-dim">{s.lastSeenRemoteAddress}</td>
                <td className="max-w-[320px] truncate px-5 py-3 font-mono text-xs text-mut" title={s.lastSeenUserAgent}>{s.lastSeenUserAgent || '—'}</td>
                <td className="px-5 py-3 font-mono text-xs text-mut" title={timeAbs(s.lastSeen)}>{relTime(s.lastSeen)}</td>
                <td className="px-5 py-3 text-right">{!s.isCurrentSession &&
                  <button onClick={() => revoke(s)} title="Revoke" className="rounded-md p-1.5 text-mut opacity-0 transition hover:bg-bad/15 hover:text-bad group-hover:opacity-100"><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <NewApiToken onClose={() => setCreating(false)} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['sessions'] }) }} />}
    </Card>
  )
}

function NewApiToken({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const submit = async () => {
    const n = name.trim()
    if (!n || busy) return
    setBusy(true)
    try { const r = await createApiToken(n); setToken(r.token) }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  const copy = async () => {
    if (!token) return
    try { await navigator.clipboard.writeText(token); toast('Token copied') }
    catch (e: any) { toast(e?.message || 'Failed', 'err') }
  }
  if (token) {
    return (
      <Modal open onClose={onDone} title="API token created"
        footer={<><button className="btn-ghost" onClick={copy}>Copy</button><button className="btn-primary" onClick={onDone}>Done</button></>}>
        <div className="space-y-3.5">
          <div className="rounded-lg border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] font-medium text-warn">
            Copy this token now. It will not be shown again.
          </div>
          <Field label="Token">
            <div className="select-all break-all rounded-lg border border-line bg-surface2 px-3.5 py-3 font-mono text-[13px] text-txt">{token}</div>
          </Field>
          <p className="text-xs text-mut">This token grants the same permissions as your user account and is non-expiring. Revoke it any time from the sessions list.</p>
        </div>
      </Modal>
    )
  }
  return (
    <Modal open onClose={onClose} title="New API token"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !name.trim()} onClick={submit}>{busy ? 'Creating…' : 'Create'}</button></>}>
      <div className="space-y-3.5">
        <Field label="Token name"><input className="input w-full" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} /></Field>
        <p className="text-xs text-mut">The token grants the same permissions as your user account and is non-expiring.</p>
      </div>
    </Modal>
  )
}

function Users() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const [adding, setAdding] = useState(false)
  const [pwUser, setPwUser] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })
  const act = async (fn: Promise<any>, msg: string) => { try { await fn; toast(msg); refresh() } catch (e: any) { toast(e?.message || 'Failed', 'err') } }
  if (isLoading || !data) return <Spinner />
  return (
    <Card>
      <CardHead title={`Users · ${data.length}`} right={<button className="btn-primary !py-1.5 text-xs" onClick={() => setAdding(true)}><Plus size={14} /> New user</button>} />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-line2 text-left text-[11px] font-bold uppercase tracking-wider text-mut">
            <th className="px-5 py-3">User</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last login</th><th className="px-5 py-3"></th>
          </tr></thead>
          <tbody>
            {data.map((u, i) => (
              <tr key={i} className="group border-t border-line hover:bg-surface2">
                <td className="px-5 py-3"><div className="font-medium text-txt">{u.displayName}</div><div className="font-mono text-xs text-mut">{u.username}</div></td>
                <td className="px-5 py-3">
                  <Chip className={u.disabled ? 'text-bad bg-bad/10' : 'text-ok bg-ok/10'}>{u.disabled ? 'Disabled' : 'Active'}</Chip>
                  {u.totpEnabled && <Chip className="ml-1.5 text-violet bg-violet/10">2FA</Chip>}
                  {u.isSsoUser && <Chip className="ml-1.5 text-cyan bg-cyan/10">SSO</Chip>}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-mut">{u.recentSessionLoggedOn ? relTime(u.recentSessionLoggedOn) : '—'}<span className="ml-2 text-mut/60">{u.recentSessionRemoteAddress || ''}</span></td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button title="Reset password" onClick={() => setPwUser(u.username)} className="rounded-md p-1.5 text-mut hover:bg-white/10 hover:text-white"><KeyRound size={14} /></button>
                    <button title={u.disabled ? 'Enable' : 'Disable'} onClick={() => act(setUserDisabled(u.username, !u.disabled), u.disabled ? 'Enabled' : 'Disabled')} className="rounded-md p-1.5 text-mut hover:bg-white/10 hover:text-white"><Power size={14} /></button>
                    {u.username !== 'admin' && <button title="Delete" onClick={() => confirm(`Delete user ${u.username}?`) && act(deleteUser(u.username), 'User deleted')} className="rounded-md p-1.5 text-mut hover:bg-bad/15 hover:text-bad"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <NewUser onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh() }} />}
      {pwUser && <ResetPw user={pwUser} onClose={() => setPwUser(null)} />}
    </Card>
  )
}

function NewUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [user, setUser] = useState(''); const [dn, setDn] = useState(''); const [pass, setPass] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!user || !pass) return; setBusy(true)
    try { await createUser(user.trim(), dn.trim() || user.trim(), pass); toast('User created'); onDone() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="New user"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create'}</button></>}>
      <div className="space-y-3.5">
        <Field label="Username"><input className="input w-full" autoFocus value={user} onChange={e => setUser(e.target.value)} /></Field>
        <Field label="Display name"><input className="input w-full" value={dn} onChange={e => setDn(e.target.value)} placeholder="(optional)" /></Field>
        <Field label="Password"><input className="input w-full" type="password" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function ResetPw({ user, onClose }: { user: string; onClose: () => void }) {
  const [pass, setPass] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!pass) return; setBusy(true)
    try { await setUserPassword(user, pass); toast(`Password reset for ${user}`); onClose() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Reset password · ${user}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Set password'}</button></>}>
      <Field label="New password"><input className="input w-full" type="password" autoComplete="new-password" autoFocus value={pass} onChange={e => setPass(e.target.value)} /></Field>
    </Modal>
  )
}

function Groups() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['groups'], queryFn: getGroups })
  const [adding, setAdding] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['groups'] })
  const builtin = ['Administrators', 'DNS Administrators', 'DHCP Administrators', 'Everyone']
  if (isLoading || !data) return <Spinner />
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-primary !py-1.5 text-xs" onClick={() => setAdding(true)}><Plus size={14} /> New group</button></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((g, i) => (
          <Card key={i} className="group p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-txt"><ShieldCheck size={16} className="text-accent" />{g.name}</div>
              {!builtin.includes(g.name) && <button onClick={() => confirm(`Delete group ${g.name}?`) && deleteGroup(g.name).then(() => { toast('Group deleted'); refresh() }).catch((e: any) => toast(e?.message || 'Failed', 'err'))} className="rounded-md p-1.5 text-mut opacity-0 transition hover:bg-bad/15 hover:text-bad group-hover:opacity-100"><Trash2 size={14} /></button>}
            </div>
            <p className="mt-1.5 text-sm text-mut">{g.description}</p>
          </Card>
        ))}
      </div>
      {adding && <NewGroup onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh() }} />}
    </div>
  )
}

function NewGroup({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!name) return; setBusy(true)
    try { await createGroup(name.trim(), desc.trim()); toast('Group created'); onDone() }
    catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="New group"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create'}</button></>}>
      <div className="space-y-3.5">
        <Field label="Group name"><input className="input w-full" autoFocus value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Description"><input className="input w-full" value={desc} onChange={e => setDesc(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function Permissions() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['permissions'], queryFn: getPermissions })
  const [perms, setPerms] = useState<any[] | null>(null)
  const [busy, setBusy] = useState(false)
  if (isLoading || !data) return <Spinner />
  const P = perms || data
  const groups = Array.from(new Set(P.flatMap((p: any) => p.groupPermissions.map((g: any) => g.name))))

  const toggle = (si: number, gname: string, field: 'canView' | 'canModify' | 'canDelete') => {
    const copy = P.map((p: any) => ({ ...p, groupPermissions: p.groupPermissions.map((g: any) => ({ ...g })) }))
    const gp = copy[si].groupPermissions.find((g: any) => g.name === gname)
    if (gp) { gp[field] = !gp[field]; if (field !== 'canView' && gp[field]) gp.canView = true }
    setPerms(copy)
  }
  const save = async () => {
    setBusy(true)
    try {
      for (const p of P) {
        const str = p.groupPermissions.map((g: any) => `${g.name}|${g.canView}|${g.canModify}|${g.canDelete}`).join('|')
        await setPermissions(p.section, str)
      }
      toast('Permissions saved'); setPerms(null); qc.invalidateQueries({ queryKey: ['permissions'] })
    } catch (e: any) { toast(e?.message || 'Failed', 'err') } finally { setBusy(false) }
  }
  const Box = ({ on, onClick }: { on: boolean; onClick: () => void }) =>
    <button onClick={onClick} className={`mx-auto block h-4 w-4 rounded transition ${on ? 'bg-accent' : 'border border-line2 bg-surface3'}`}>{on && <Check size={12} className="mx-auto text-[#10210a]" strokeWidth={3} />}</button>

  return (
    <Card>
      <CardHead title="Group permissions" right={<button className="btn-primary !py-1.5 text-xs" disabled={busy || !perms} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>} />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line2 text-[11px] font-bold uppercase tracking-wider text-mut">
              <th className="px-5 py-3 text-left">Section</th>
              {groups.map(g => <th key={g} className="px-3 py-3 text-center" colSpan={3}>{g}</th>)}
            </tr>
            <tr className="border-b border-line text-[9px] font-semibold uppercase text-mut">
              <th></th>{groups.map(g => <Fragment key={g}><th className="px-1 pb-2 text-center font-normal">view</th><th className="px-1 pb-2 text-center font-normal">edit</th><th className="px-1 pb-2 text-center font-normal">del</th></Fragment>)}
            </tr>
          </thead>
          <tbody>
            {P.map((p: any, i: number) => (
              <tr key={i} className="border-t border-line hover:bg-surface2">
                <td className="px-5 py-2.5 text-[13px] font-medium text-txt">{p.section}</td>
                {groups.map(g => {
                  const gp = p.groupPermissions.find((x: any) => x.name === g)
                  const dis = g === 'Administrators'
                  return <Fragment key={g}>
                    <td className="px-1 py-2.5">{dis ? <Check size={13} className="mx-auto text-ok/50" /> : <Box on={!!gp?.canView} onClick={() => toggle(i, g, 'canView')} />}</td>
                    <td className="px-1 py-2.5">{dis ? <Check size={13} className="mx-auto text-ok/50" /> : <Box on={!!gp?.canModify} onClick={() => toggle(i, g, 'canModify')} />}</td>
                    <td className="px-1 py-2.5">{dis ? <Check size={13} className="mx-auto text-ok/50" /> : <Box on={!!gp?.canDelete} onClick={() => toggle(i, g, 'canDelete')} />}</td>
                  </Fragment>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
