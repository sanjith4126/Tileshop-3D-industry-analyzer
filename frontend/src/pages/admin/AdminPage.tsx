import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiGet, apiSend } from '../../api/client'
import { useAuth } from '../../auth/auth'
import { ErrorState, Loading, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'
import { ConfigStatus, useOverview } from '../OverviewData'

const ROLES = ['Viewer', 'Inspector', 'MaintenanceEngineer', 'Admin']
interface User { id: string; email: string; displayName: string | null; roles: string[]; disabled: boolean }
interface AuditEntry { id: string; timestampUtc: string; userName: string | null; action: string; entityId: string | null; detailsJson: string | null }

function Users({ token, self }: { token: string; self: string }) {
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => fetchAuth<User[]>('/api/admin/users', token) })
  const [form, setForm] = useState({ email: '', displayName: '', role: 'Viewer', password: '' })
  const create = useMutation({
    mutationFn: () => apiSend<User>('POST', '/api/admin/users', form, token),
    onSuccess: () => { setForm({ email: '', displayName: '', role: 'Viewer', password: '' }); qc.invalidateQueries({ queryKey: ['admin-users'] }) },
  })
  const update = useMutation({
    mutationFn: (u: { id: string; role: string; disabled: boolean }) => apiSend<User>('PUT', `/api/admin/users/${u.id}`, { role: u.role, disabled: u.disabled }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
  const field = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs'

  return (
    <Panel title="Users">
      {users.isPending ? <Loading /> : users.isError ? <ErrorState error={users.error} /> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2 font-normal">User</th><th className="font-normal">Role</th><th className="font-normal">Status</th></tr></thead>
          <tbody>
            {users.data.map((u) => (
              <tr key={u.id} className="border-t border-slate-800/70">
                <td className="px-3 py-1.5">{u.email}<span className="block text-xs text-slate-500">{u.displayName}</span></td>
                <td>
                  <select aria-label={`Role of ${u.email}`} value={u.roles[0] ?? 'Viewer'} disabled={u.email === self || update.isPending}
                    onChange={(e) => update.mutate({ id: u.id, role: e.target.value, disabled: u.disabled })} className={field}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <button disabled={u.email === self || update.isPending} onClick={() => update.mutate({ id: u.id, role: u.roles[0] ?? 'Viewer', disabled: !u.disabled })}
                    className={`rounded px-2 py-0.5 text-xs disabled:opacity-40 ${u.disabled ? 'bg-red-900/60' : 'bg-slate-800'}`}>{u.disabled ? 'Disabled — enable' : 'Active — disable'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {update.isError && <p role="alert" className="px-3 text-xs text-red-300">{(update.error as Error).message}</p>}
      <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="flex flex-wrap items-end gap-2 border-t border-slate-800 p-3 text-xs" aria-label="Create user">
        <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${field} block`} /></label>
        <label>Name<input value={form.displayName} maxLength={100} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={`${field} block`} /></label>
        <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={`${field} block`}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>Password (min 12)<input required type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${field} block`} /></label>
        <button type="submit" disabled={create.isPending} className="rounded bg-cyan-700 px-3 py-1.5 font-semibold hover:bg-cyan-600 disabled:opacity-50">Create user</button>
        {create.isError && <p role="alert" className="w-full text-red-300">{(create.error as Error).message}</p>}
      </form>
    </Panel>
  )
}

async function fetchAuth<T>(path: string, token: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(res.status === 403 ? 'Admin role required' : `Request failed (${res.status})`)
  return (await res.json()) as T
}

export default function AdminPage() {
  const { session, hasRole } = useAuth()
  const qc = useQueryClient()
  const overview = useOverview()
  const sim = useQuery({ queryKey: ['simulator'], queryFn: ({ signal }) => apiGet<{ paused: boolean; anchorUtc: string | null; lastReadingUtc: string | null }>('/api/admin/simulator', signal), refetchInterval: 7000 })
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => fetchAuth<AuditEntry[]>('/api/admin/audit?limit=50', session!.token), enabled: hasRole('Admin') })
  const toggle = useMutation({
    mutationFn: (paused: boolean) => apiSend('PUT', '/api/admin/simulator', { paused }, session?.token ?? null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['simulator'] }); qc.invalidateQueries({ queryKey: ['overview'] }) },
  })
  const reset = useMutation({
    mutationFn: () => apiSend<{ anchorUtc: string }>('POST', '/api/admin/reset-demo', undefined, session?.token ?? null),
    onSuccess: () => qc.invalidateQueries(),
  })

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-semibold">Administration</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Configuration status">
          {overview.isPending ? <Loading /> : overview.isError ? <ErrorState error={overview.error} /> : <ConfigStatus config={overview.data.config} />}
        </Panel>
        <Panel title="Live simulator and demo data">
          <div className="space-y-3 p-3 text-sm">
            {sim.data && (
              <p>Simulator: <b className={sim.data.paused ? 'text-amber-300' : 'text-green-300'}>{sim.data.paused ? 'Paused' : 'Running'}</b>
                <span className="block text-xs text-slate-400">Last reading {formatUtc(sim.data.lastReadingUtc)} · seed anchor {formatUtc(sim.data.anchorUtc)}</span></p>
            )}
            {!hasRole('Admin') ? <p className="text-xs text-slate-400">Sign in as Admin to pause the simulator, reset demo data, manage users and view the audit log.</p> : (
              <>
                <button onClick={() => toggle.mutate(!sim.data?.paused)} disabled={toggle.isPending || !sim.data} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
                  {sim.data?.paused ? 'Resume simulator' : 'Pause simulator'}
                </button>
                <div>
                  <button disabled={reset.isPending} onClick={() => { if (window.confirm('Reset demo data? Synthetic demo rows are deleted and re-seeded (about 20 s). User-created rows are kept.')) reset.mutate() }}
                    className="rounded bg-red-900/70 px-3 py-1.5 text-xs font-semibold hover:bg-red-800 disabled:opacity-50">{reset.isPending ? 'Resetting… (about 20 s)' : 'Reset demo data'}</button>
                  <p className="mt-1 text-[11px] text-slate-500">Deletes only rows with DataOrigin = Synthetic and the demo seed batch, in one transaction, then re-seeds. User-created rows are never touched.</p>
                  {reset.isSuccess && <p className="text-xs text-green-300">Demo data reset (anchor {formatUtc(reset.data.anchorUtc)}).</p>}
                  {reset.isError && <p role="alert" className="text-xs text-red-300">{(reset.error as Error).message}</p>}
                </div>
              </>
            )}
            {toggle.isError && <p role="alert" className="text-xs text-red-300">{(toggle.error as Error).message}</p>}
          </div>
        </Panel>
      </div>
      {session && hasRole('Admin') && <Users token={session.token} self={session.email} />}
      {hasRole('Admin') && (
        <Panel title="Audit log (latest 50)">
          {audit.isPending ? <Loading /> : audit.isError ? <ErrorState error={audit.error} /> : (
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500"><tr><th className="px-3 py-1 font-normal">Time</th><th className="font-normal">User</th><th className="font-normal">Action</th><th className="font-normal">Entity</th></tr></thead>
              <tbody>{audit.data.map((a) => (
                <tr key={a.id} className="border-t border-slate-800/70"><td className="px-3 py-1 whitespace-nowrap">{formatUtc(a.timestampUtc)}</td><td>{a.userName}</td><td className="font-mono">{a.action}</td><td className="font-mono text-slate-400">{a.entityId}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Panel>
      )}
    </div>
  )
}
