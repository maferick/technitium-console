import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, LogIn } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [user, setUser] = useState('admin')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await signIn(user, pass); nav('/') }
    catch (e: any) { setErr(e?.message || 'Login failed') }
    finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm animate-fadeUp">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent shadow-glow">
            <Server size={22} />
          </div>
          <div className="text-center">
            <h1 className="bg-gradient-to-r from-white to-[#d9f99d] bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">DNS Console</h1>
            <p className="mt-1 font-mono text-xs text-mut">Technitium · sign in to continue</p>
          </div>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dim">Username</label>
            <input className="input w-full" value={user} onChange={e => setUser(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dim">Password</label>
            <input className="input w-full" type="password" value={pass} onChange={e => setPass(e.target.value)} />
          </div>
          {err && <div className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">{err}</div>}
          <button className="btn-primary w-full justify-center" disabled={busy}>
            {busy ? 'Signing in…' : <><LogIn size={15} /> Sign in</>}
          </button>
        </form>
      </div>
    </div>
  )
}
