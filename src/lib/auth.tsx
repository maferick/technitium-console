import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as api from './api'

interface AuthCtx {
  info: api.ServerInfo | null
  ready: boolean
  signIn: (u: string, p: string) => Promise<void>
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<api.ServerInfo | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      if (api.getToken()) {
        const i = await api.sessionInfo()
        if (i) setInfo(i); else api.clearToken()
      }
      setReady(true)
    })()
  }, [])

  // global 401 handler: any ApiError with sessionExpired clears auth
  useEffect(() => {
    const onErr = (e: any) => { if (e?.detail?.sessionExpired) { api.clearToken(); setInfo(null) } }
    window.addEventListener('tdns-auth-error', onErr)
    return () => window.removeEventListener('tdns-auth-error', onErr)
  }, [])

  const signIn = async (u: string, p: string) => { setInfo(await api.login(u, p)) }
  const signOut = async () => { await api.logout(); setInfo(null) }

  return <Ctx.Provider value={{ info, ready, signIn, signOut }}>{children}</Ctx.Provider>
}
