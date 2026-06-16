import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import QueryLog from './pages/QueryLog'
import Clients from './pages/Clients'
import Blocking from './pages/Blocking'
import Lookup from './pages/Lookup'
import Dhcp from './pages/Dhcp'
import Zones from './pages/Zones'
import Settings from './pages/Settings'
import Cluster from './pages/Cluster'
import CachePage from './pages/Cache'
import Apps from './pages/Apps'
import Admin from './pages/Admin'
import ZoneEditor from './pages/ZoneEditor'
import Lists from './pages/Lists'
import Logs from './pages/Logs'
import About from './pages/About'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 } },
})

function RequireAuth() {
  const { info, ready } = useAuth()
  if (!ready) return <div className="grid min-h-screen place-items-center text-mut">Loading…</div>
  if (!info) return <Navigate to="/login" replace />
  return <Layout />
}

function GuestOnly() {
  const { info, ready } = useAuth()
  if (!ready) return null
  if (info) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<Login />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route index element={<Dashboard />} />
              <Route path="logs" element={<QueryLog />} />
              <Route path="lookup" element={<Lookup />} />
              <Route path="clients" element={<Clients />} />
              <Route path="dhcp" element={<Dhcp />} />
              <Route path="zones" element={<Zones />} />
              <Route path="zones/:zone" element={<ZoneEditor />} />
              <Route path="cache" element={<CachePage />} />
              <Route path="lists" element={<Lists />} />
              <Route path="blocking" element={<Blocking />} />
              <Route path="apps" element={<Apps />} />
              <Route path="settings" element={<Settings />} />
              <Route path="cluster" element={<Cluster />} />
              <Route path="admin" element={<Admin />} />
              <Route path="logfiles" element={<Logs />} />
              <Route path="about" element={<About />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
