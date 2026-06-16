// Thin typed client for the Technitium DNS REST API.
// Same-origin in prod (nginx proxies /api -> Technitium); dev proxy via vite.

const BASE = '/api'
const TOKEN_KEY = 'tdns_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(message: string, public sessionExpired = false) { super(message) }
}

async function call<T = any>(path: string, params: Record<string, string | number | boolean | undefined> = {}, withToken = true): Promise<T> {
  const u = new URLSearchParams()
  if (withToken) u.set('token', getToken())
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.set(k, String(v))
  const res = await fetch(`${BASE}${path}?${u.toString()}`)
  let json: any
  try { json = await res.json() } catch { throw new ApiError(`Bad response (${res.status})`) }
  if (json.status !== 'ok') {
    const msg = json.errorMessage || json.status || 'Request failed'
    const expired = /invalid token|session|not logged|unauthor/i.test(msg)
    if (expired) window.dispatchEvent(new CustomEvent('tdns-auth-error', { detail: { sessionExpired: true } }))
    throw new ApiError(msg, expired)
  }
  return json as T
}

// ---- auth ----
export interface ServerInfo { version: string; dnsServerDomain: string; clusterInitialized: boolean; clusterNodes?: any[]; permissions?: any }
export async function login(user: string, pass: string) {
  const r = await call<{ token: string; info: ServerInfo }>('/user/login', { user, pass, includeInfo: true }, false)
  setToken(r.token); return r.info
}
export async function sessionInfo() { return call<{ info: ServerInfo }>('/user/session/get', {}).then(r => r.info).catch(() => null) }
export async function logout() { try { await call('/user/logout', {}) } finally { clearToken() } }

// ---- dashboard ----
export type StatRange = 'LastHour' | 'LastDay' | 'LastWeek' | 'LastMonth' | 'LastYear'
export interface Stats {
  totalQueries: number; totalNoError: number; totalServerFailure: number; totalNxDomain: number
  totalRefused: number; totalAuthoritative: number; totalRecursive: number; totalCached: number
  totalBlocked: number; totalDropped: number; totalClients: number
  zones: number; cachedEntries: number; allowListZones: number; blockListZones: number
}
export interface ChartData { labels: string[]; datasets: { label: string; data: number[]; backgroundColor?: string | string[]; borderColor?: string }[] }
export interface TopItem { name: string; domain?: string; hits: number; rateLimited?: boolean }
export interface DashboardResponse {
  stats: Stats; mainChartData: ChartData; queryResponseChartData: ChartData; queryTypeChartData: ChartData
  topClients: TopItem[]; topDomains: TopItem[]; topBlockedDomains: TopItem[]
}
export async function getDashboard(type: StatRange, node = '') {
  return call<{ response: DashboardResponse }>('/dashboard/stats/get', { type, node }).then(r => r.response)
}
// full top-N lists for the dashboard "More" modal
export type TopStatsType = 'TopClients' | 'TopDomains' | 'TopBlockedDomains'
export async function getTopStats(type: StatRange, statsType: TopStatsType, limit = 1000) {
  const key = statsType === 'TopClients' ? 'topClients' : statsType === 'TopDomains' ? 'topDomains' : 'topBlockedDomains'
  return call<{ response: Record<string, TopItem[]> }>('/dashboard/stats/getTop', { type, statsType, limit }).then(r => r.response[key] || [])
}
// blocking quick controls (dashboard Top Blocked card)
export const temporarilyDisableBlocking = (minutes: number) => call('/settings/temporaryDisableBlocking', { minutes })
export const forceUpdateBlockLists = () => call('/settings/forceUpdateBlockLists', {})
export const setBlockingEnabled = (enableBlocking: boolean) => call('/settings/set', { enableBlocking })

// ---- query log (Query Logs Sqlite app) ----
const QL = { name: 'Query Logs (Sqlite)', classPath: 'QueryLogsSqlite.App' }
export interface QueryLogEntry {
  rowNumber: number; timestamp: string; clientIpAddress: string; protocol: string
  responseType: string; rcode: string; qname: string; qtype: string; qclass: string; answer: string | null
}
export interface QueryLogPage { pageNumber: number; totalPages: number; totalEntries: number; entries: QueryLogEntry[] }
export interface QueryLogFilter {
  pageNumber?: number; entriesPerPage?: number; descendingOrder?: boolean
  clientIpAddress?: string; qname?: string; qtype?: string; responseType?: string; rcode?: string; protocol?: string
}
export async function getQueryLogs(f: QueryLogFilter) {
  return call<{ response: QueryLogPage }>('/logs/query', {
    ...QL, descendingOrder: true, entriesPerPage: 25, pageNumber: 1, ...f,
  }).then(r => r.response)
}

// ---- zones ----
export interface Zone { name: string; type: string; disabled: boolean; internal: boolean; dnssecStatus: string; catalog: string | null; soaSerial: number; lastModified: string }
export async function getZones() { return call<{ response: { zones: Zone[] } }>('/zones/list', {}).then(r => r.response.zones) }

// ---- dhcp ----
export interface DhcpLease { scope: string; type: string; hardwareAddress: string; address: string; hostName: string | null; leaseObtained: string; leaseExpires: string }
export async function getLeases() { return call<{ response: { leases: DhcpLease[] } }>('/dhcp/leases/list', {}).then(r => r.response.leases) }

// ---- dns lookup ----
export interface ResolveRecord { Name: string; Type: string; Class: string; TTL: string; RDATA: any; DnssecStatus: string }
export interface ResolveResult { Question: { Name: string; Type: string; Class: string }; Answer?: ResolveRecord[]; Authority?: ResolveRecord[] }
export async function resolve(domain: string, type: string, opts: { server?: string; protocol?: string; dnssec?: boolean } = {}) {
  return call<{ response: { result: ResolveResult } }>('/dnsclient/resolve', {
    server: opts.server || 'this-server', domain, type, protocol: opts.protocol || 'Udp', dnssec: !!opts.dnssec,
  }).then(r => r.response.result)
}

// ---- settings (read) ----
export interface SettingsSummary {
  forwarders: string[] | null; forwarderProtocol: string; dnssecValidation: boolean
  enableBlocking: boolean; blockListUrls: string[]; recursion: string
  blockListUpdateIntervalHours: number; blockListNextUpdatedOn?: string
}
export async function getSettings() { return call<{ response: any }>('/settings/get', {}).then(r => r.response) }
export const saveSettings = (patch: Record<string, any>) => call('/settings/set', patch)

// ---- cluster ----
export interface ClusterNode { name: string; type: string; state: string; lastSeen: string | null }
export async function getCluster() { return call<{ response: { clusterInitialized: boolean; clusterDomain: string; clusterNodes: ClusterNode[] } }>('/admin/cluster/state', {}).then(r => r.response) }

// ---- cache browser ----
export interface CacheRecord { name: string; type: string; ttl: string; rData: any; dnssecStatus?: string; lastUsedOn?: string }
export async function getCache(domain: string) {
  return call<{ response: { domain: string; zones: string[]; records: CacheRecord[] } }>('/cache/list', { domain, direction: 'ChildZones' }).then(r => r.response)
}
export const deleteCache = (domain: string) => call('/cache/delete', { domain })
export const flushCache = () => call('/cache/flush', {})

// ---- administration ----
export interface Session { username: string; isCurrentSession: boolean; partialToken: string; type: string; tokenName: string | null; lastSeen: string; lastSeenRemoteAddress: string; lastSeenUserAgent: string }
export async function getSessions() { return call<{ response: { sessions: Session[] } }>('/admin/sessions/list', {}).then(r => r.response.sessions) }
export const deleteSession = (partialToken: string) => call('/admin/sessions/delete', { partialToken })

export interface User { username: string; displayName: string; disabled: boolean; isSsoUser: boolean; totpEnabled: boolean; recentSessionLoggedOn?: string; recentSessionRemoteAddress?: string }
export async function getUsers() { return call<{ response: { users: User[] } }>('/admin/users/list', {}).then(r => r.response.users) }

export interface Group { name: string; description: string }
export async function getGroups() { return call<{ response: { groups: Group[] } }>('/admin/groups/list', {}).then(r => r.response.groups) }

export interface GroupPerm { name: string; canView: boolean; canModify: boolean; canDelete: boolean }
export interface Permission { section: string; groupPermissions: GroupPerm[]; userPermissions: any[] }
export async function getPermissions() { return call<{ response: { permissions: Permission[] } }>('/admin/permissions/list', {}).then(r => r.response.permissions) }
// groupPermissions string = "Name|view|modify|delete|Name2|..." flattened with |
export const setPermissions = (section: string, groupPermissions: string, userPermissions = '') => call('/admin/permissions/set', { section, groupPermissions, userPermissions })

// ---- logs (diagnostic) ----
export interface LogFile { fileName: string; size: string }
export async function getLogFiles() { return call<{ response: { logFiles: LogFile[] } }>('/logs/list', {}).then(r => r.response.logFiles) }
export const logDownloadUrl = (fileName: string) => `/api/logs/download?token=${getToken()}&fileName=${encodeURIComponent(fileName)}`
export const deleteLog = (log: string) => call('/logs/delete', { log })

// ---- app store / manage ----
export interface StoreApp { name: string; version: string; description: string; url: string; installed?: boolean; installedVersion?: string; updateAvailable?: boolean }
export async function getStoreApps() { return call<{ response: { storeApps: StoreApp[] } }>('/apps/listStoreApps', {}).then(r => r.response.storeApps) }
export const installApp = (name: string, url: string) => call('/apps/downloadAndInstall', { name, url })
export const updateApp = (name: string, url: string) => call('/apps/downloadAndUpdate', { name, url })
export const uninstallApp = (name: string) => call('/apps/uninstall', { name })
export async function getAppConfig(name: string) { return call<{ response: { config: string } }>('/apps/config/get', { name }).then(r => r.response.config) }
export const setAppConfig = (name: string, config: string) => call('/apps/config/set', { name, config })

// ---- dnssec lifecycle ----
// Sign accepts an options object so the UI can offer algorithm/curve/nxProof/TTL/rollover.
export const signZone = (zone: string, o: Record<string, any> = {}) =>
  call('/zones/dnssec/sign', { zone, algorithm: 'ECDSA', curve: 'P256', dnsKeyTtl: 86400, zskRolloverDays: 30, nxProof: 'NSEC', ...o })
export const unsignZone = (zone: string) => call('/zones/dnssec/unsign', { zone })

export interface DnssecKey {
  keyTag: number; keyType: string; algorithm: string; state: string
  stateChangedOn?: string; stateReadyBy?: string; isRetiring: boolean; rolloverDays: number
}
export interface DnssecProperties {
  name: string; type: string; disabled: boolean; dnssecStatus: string; dnsKeyTtl: number; dnssecPrivateKeys: DnssecKey[]
}
export async function getDnssecProperties(zone: string) {
  return call<{ response: DnssecProperties }>('/zones/dnssec/properties/get', { zone }).then(r => r.response)
}
export interface DsRecordInfo { keyTag: number; dnsKeyState: string; algorithm: string; publicKey: string; digests: { digestType: string; digest: string }[] }
export async function getDS(zone: string) {
  return call<{ response: { name: string; dnssecStatus: string; dsRecords: DsRecordInfo[] } }>('/zones/dnssec/viewDS', { zone }).then(r => r.response)
}
// keyType: KeySigningKey|ZoneSigningKey ; algorithm: RSA|ECDSA|EDDSA (+ curve or hashAlgorithm/keySize)
export const addDnssecPrivateKey = (zone: string, p: Record<string, any>) => call('/zones/dnssec/properties/addPrivateKey', { zone, ...p })
export const updateDnssecPrivateKey = (zone: string, keyTag: number, rolloverDays: number) => call('/zones/dnssec/properties/updatePrivateKey', { zone, keyTag, rolloverDays })
export const deleteDnssecPrivateKey = (zone: string, keyTag: number) => call('/zones/dnssec/properties/deletePrivateKey', { zone, keyTag })
export const publishAllDnssecKeys = (zone: string) => call('/zones/dnssec/properties/publishAllPrivateKeys', { zone })
export const rolloverDnssecKey = (zone: string, keyTag: number) => call('/zones/dnssec/properties/rolloverDnsKey', { zone, keyTag })
export const retireDnssecKey = (zone: string, keyTag: number) => call('/zones/dnssec/properties/retireDnsKey', { zone, keyTag })
export const convertToNSEC = (zone: string) => call('/zones/dnssec/properties/convertToNSEC', { zone })
export const convertToNSEC3 = (zone: string) => call('/zones/dnssec/properties/convertToNSEC3', { zone })
export const updateNSEC3Params = (zone: string, iterations: number, saltLength: number) => call('/zones/dnssec/properties/updateNSEC3Params', { zone, iterations, saltLength })
export const updateDnsKeyTtl = (zone: string, ttl: number) => call('/zones/dnssec/properties/updateDnsKeyTtl', { zone, ttl })

// ---- zone options ----
export interface UpdateSecurityPolicy { tsigKeyName: string; domain: string; allowedTypes: string[] }
export interface ZoneOptions {
  name: string; type: string; internal: boolean; disabled: boolean; dnssecStatus: string
  catalog: string | null; overrideCatalogQueryAccess: boolean; overrideCatalogZoneTransfer: boolean; overrideCatalogNotify: boolean
  queryAccess: string; queryAccessNetworkACL: string[]
  zoneTransfer: string; zoneTransferNetworkACL: string[]; zoneTransferTsigKeyNames: string[]
  notify: string; notifyNameServers: string[]; notifyFailed?: boolean; notifyFailedFor?: string[]
  update: string; updateNetworkACL: string[]; updateSecurityPolicies: UpdateSecurityPolicy[]
  primaryNameServerAddresses?: string[]; primaryZoneTransferProtocol?: string; primaryZoneTransferTsigKeyName?: string; validateZone?: boolean
  availableCatalogZoneNames?: string[]; availableTsigKeyNames?: string[]
}
export async function getZoneOptions(zone: string) {
  return call<{ response: ZoneOptions }>('/zones/options/get', { zone, includeAvailableTsigKeyNames: true, includeAvailableCatalogZoneNames: true }).then(r => r.response)
}
export const setZoneOptions = (zone: string, patch: Record<string, any>) => call('/zones/options/set', { zone, ...patch })

// ---- API tokens (user-scoped, non-expiring) ----
export interface CreatedToken { username: string; tokenName: string; token: string }
// Uses the current session token; the returned token is shown once and cannot be retrieved again.
export async function createApiToken(tokenName: string) {
  return call<CreatedToken>('/user/createToken', { tokenName })
}

// ---- settings backup / restore ----
export interface BackupFlags {
  authConfig?: boolean; clusterConfig?: boolean; webServiceSettings?: boolean; dnsSettings?: boolean; logSettings?: boolean
  zones?: boolean; allowedZones?: boolean; blockedZones?: boolean; blockLists?: boolean; apps?: boolean; scopes?: boolean; stats?: boolean; logs?: boolean
}
export function settingsBackupUrl(flags: BackupFlags) {
  const u = new URLSearchParams({ token: getToken() })
  for (const [k, v] of Object.entries(flags)) u.set(k, String(!!v))
  return `${BASE}/settings/backup?${u.toString()}`
}
export async function restoreSettings(file: File, flags: BackupFlags & { deleteExistingFiles?: boolean }) {
  const u = new URLSearchParams({ token: getToken() })
  for (const [k, v] of Object.entries(flags)) u.set(k, String(!!v))
  const fd = new FormData(); fd.append('fileBackupZip', file, file.name)
  const res = await fetch(`${BASE}/settings/restore?${u.toString()}`, { method: 'POST', body: fd })
  let json: any; try { json = await res.json() } catch { throw new ApiError(`Bad response (${res.status})`) }
  if (json.status !== 'ok') throw new ApiError(json.errorMessage || json.status || 'Restore failed')
  return json.response
}

// ---- dhcp scope create/edit (core fields) ----
export const saveScope = (p: Record<string, any>) => call('/dhcp/scopes/set', p)
export async function getScope(name: string) { return call<{ response: any }>('/dhcp/scopes/get', { name }).then(r => r.response) }

// ---- apps ----
export interface DnsApp { name: string; version: string; dnsApps: { classPath: string; description: string }[] }
export async function getApps() { return call<{ response: { apps: DnsApp[] } }>('/apps/list', {}).then(r => r.response.apps) }

// ---- dhcp scopes ----
export interface DhcpScope { name: string; enabled: boolean; startingAddress: string; endingAddress: string; subnetMask: string; networkAddress: string; interfaceAddress: string }
export async function getScopes() { return call<{ response: { scopes: DhcpScope[] } }>('/dhcp/scopes/list', {}).then(r => r.response.scopes) }

// ---- allow / block lists ----
export async function listAllowed(domain = '') { return call<{ response: { domain: string; zones: string[]; records: any[] } }>('/allowed/list', { domain }).then(r => r.response) }
export async function listBlocked(domain = '') { return call<{ response: { domain: string; zones: string[]; records: any[] } }>('/blocked/list', { domain }).then(r => r.response) }
export const addAllowed = (domain: string) => call('/allowed/add', { domain })
export const addBlocked = (domain: string) => call('/blocked/add', { domain })
export const deleteAllowed = (domain: string) => call('/allowed/delete', { domain })
export const deleteBlocked = (domain: string) => call('/blocked/delete', { domain })

// ---- zones CRUD ----
export const createZone = (zone: string, type = 'Primary') => call('/zones/create', { zone, type })
export const deleteZone = (zone: string) => call('/zones/delete', { zone })
export const setZoneEnabled = (zone: string, on: boolean) => call(on ? '/zones/enable' : '/zones/disable', { zone })
export interface ZoneRecord { name: string; type: string; ttl: number; disabled: boolean; rData: any }
export async function getRecords(zone: string) {
  return call<{ response: { records: ZoneRecord[] } }>('/zones/records/get', { domain: zone, zone, listZone: true }).then(r => r.response.records)
}
// record field map per type (rData keys = add/delete params)
export const RTYPES: Record<string, { k: string; label: string; type?: string }[]> = {
  A: [{ k: 'ipAddress', label: 'IPv4 address' }],
  AAAA: [{ k: 'ipAddress', label: 'IPv6 address' }],
  CNAME: [{ k: 'cname', label: 'Canonical name (FQDN)' }],
  NS: [{ k: 'nameServer', label: 'Name server (FQDN)' }],
  PTR: [{ k: 'ptrName', label: 'Pointer (FQDN)' }],
  TXT: [{ k: 'text', label: 'Text value' }],
  MX: [{ k: 'preference', label: 'Preference', type: 'number' }, { k: 'exchange', label: 'Mail server (FQDN)' }],
  SRV: [{ k: 'priority', label: 'Priority', type: 'number' }, { k: 'weight', label: 'Weight', type: 'number' }, { k: 'port', label: 'Port', type: 'number' }, { k: 'target', label: 'Target (FQDN)' }],
  CAA: [{ k: 'flags', label: 'Flags', type: 'number' }, { k: 'tag', label: 'Tag (issue/iodef)' }, { k: 'value', label: 'Value' }],
}
export const addRecord = (zone: string, domain: string, type: string, ttl: number, fields: Record<string, string>) =>
  call('/zones/records/add', { zone, domain, type, ttl, ...fields })
export const deleteRecord = (zone: string, domain: string, type: string, fields: Record<string, string>) =>
  call('/zones/records/delete', { zone, domain, type, ...fields })

// ---- dhcp scope ops ----
export const setScopeEnabled = (name: string, on: boolean) => call(on ? '/dhcp/scopes/enable' : '/dhcp/scopes/disable', { name })
export const deleteScope = (name: string) => call('/dhcp/scopes/delete', { name })
export const addReservedLease = (scope: string, hardwareAddress: string, ipAddress: string, comment = '') => call('/dhcp/scopes/addReservedLease', { name: scope, hardwareAddress, ipAddress, comment })
export const removeReservedLease = (scope: string, hardwareAddress: string) => call('/dhcp/scopes/removeReservedLease', { name: scope, hardwareAddress })

// ---- users / groups CRUD ----
export const createUser = (user: string, displayName: string, pass: string) => call('/admin/users/create', { user, displayName, pass })
export const setUserDisabled = (user: string, disabled: boolean) => call('/admin/users/set', { user, disabled })
export const setUserPassword = (user: string, newPassword: string) => call('/admin/users/set', { user, newPassword })
export const deleteUser = (user: string) => call('/admin/users/delete', { user })
export const createGroup = (group: string, description = '') => call('/admin/groups/create', { group, description })
export const deleteGroup = (group: string) => call('/admin/groups/delete', { group })
export async function getSso() { return call<{ response: any }>('/admin/sso/get', {}).then(r => r.response) }
export const setSso = (p: Record<string, any>) => call('/admin/sso/set', p)
