import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseZap, KeyRound, Pause, Play, ScrollText, Settings2, ShieldCheck, TriangleAlert, UserPlus, Users as UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { apiGet, apiSend } from '../../api/client'
import { useAuth } from '../../auth/auth'
import { EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'
import { ConfigStatus, useOverview } from '../OverviewData'

const ROLES = ['Administrator', 'PlantManager', 'MaintenanceEngineer', 'Inspector']
interface User { id: string; email: string; displayName: string | null; roles: string[]; disabled: boolean }
interface AuditEntry { id: string; timestampUtc: string; userName: string | null; action: string; entityId: string | null; detailsJson: string | null }

function Users({ self }: { self: string }) {
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => apiGet<User[]>('/api/admin/users') })
  const [form, setForm] = useState({ email: '', displayName: '', role: 'PlantManager', password: '' })
  const create = useMutation({
    mutationFn: () => apiSend<User>('POST', '/api/admin/users', form),
    onSuccess: () => { setForm({ email: '', displayName: '', role: 'PlantManager', password: '' }); qc.invalidateQueries({ queryKey: ['admin-users'] }) },
  })
  const update = useMutation({
    mutationFn: (u: { id: string; role: string; disabled: boolean }) => apiSend<User>('PUT', `/api/admin/users/${u.id}`, { role: u.role, disabled: u.disabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
  return (
    <Panel title="Users" icon={<UsersIcon className="size-4" />} className="overflow-x-auto">
      {users.isPending ? <Loading /> : users.isError ? <ErrorState error={users.error} /> : (
        <table className="data-table">
          <thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {users.data.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-muted ring-1 ring-line" aria-hidden="true">{(u.displayName ?? u.email).slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0"><span className="block truncate text-fg">{u.email}</span><span className="block text-xs text-subtle">{u.displayName}</span></span>
                  </span>
                </td>
                <td>
                  <select aria-label={`Role of ${u.email}`} value={u.roles[0] ?? 'PlantManager'} disabled={u.email === self || update.isPending}
                    onChange={(e) => update.mutate({ id: u.id, role: e.target.value, disabled: u.disabled })} className="input input-sm w-48">
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <button disabled={u.email === self || update.isPending} onClick={() => update.mutate({ id: u.id, role: u.roles[0] ?? 'PlantManager', disabled: !u.disabled })}
                    className={`btn btn-sm ${u.disabled ? 'btn-danger' : 'btn-secondary'}`}>{u.disabled ? 'Disabled — enable' : 'Active — disable'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {update.isError && <p role="alert" className="px-4 py-2 text-xs text-crit">{(update.error as Error).message}</p>}
      <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} aria-label="Create user"
        className="grid gap-3 border-t border-line bg-sunken/50 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_12rem_1fr_auto] xl:items-end">
        <label><span className="field-label">Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></label>
        <label><span className="field-label">Name</span><input value={form.displayName} maxLength={100} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="input" /></label>
        <label><span className="field-label">Role</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label><span className="field-label">Password (min 12)</span><input required type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" /></label>
        <button type="submit" disabled={create.isPending} className="btn btn-primary"><UserPlus className="size-4" aria-hidden="true" />Create user</button>
        {create.isError && <p role="alert" className="text-xs text-crit sm:col-span-2 xl:col-span-5">{(create.error as Error).message}</p>}
      </form>
    </Panel>
  )
}

interface RoleEntry { role: string; permissions: { name: string; capability: string; isExtension: boolean }[] }

/** The role → permission mapping, read-only: it is seed data and changes only by migration (section 12.2). */
function RolesAndPermissions() {
  const q = useQuery({ queryKey: ['admin-roles'], queryFn: ({ signal }) => apiGet<RoleEntry[]>('/api/admin/roles', signal) })
  return (
    <Panel title="Roles and permissions · read-only" icon={<KeyRound className="size-4" />} className="overflow-x-auto">
      {q.isPending ? <Loading /> : q.isError ? <ErrorState error={q.error} /> : (
        <table className="data-table text-xs">
          <thead><tr><th>Role</th><th>Permissions</th></tr></thead>
          <tbody>{q.data.map((r) => (
            <tr key={r.role}>
              <td className="font-medium whitespace-nowrap text-fg">{r.role}</td>
              <td><ul className="flex flex-wrap gap-1">{r.permissions.map((p) => (
                <li key={p.name} title={p.capability + (p.isExtension ? ' (extension)' : '')} className="chip font-mono">{p.name}</li>
              ))}</ul></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <p className="px-4 py-2 text-[11px] text-subtle">Changing this mapping is a database migration, so the authorisation tests generated from Appendix B stay authoritative.</p>
    </Panel>
  )
}

export default function AdminPage() {
  const { session, can } = useAuth()
  const qc = useQueryClient()
  const overview = useOverview()
  const sim = useQuery({ queryKey: ['simulator'], queryFn: ({ signal }) => apiGet<{ paused: boolean; anchorUtc: string | null; lastReadingUtc: string | null }>('/api/admin/simulator', signal), refetchInterval: 7000, enabled: can('simulator.control') })
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => apiGet<AuditEntry[]>('/api/admin/audit?limit=50'), enabled: can('audit.view') })
  const toggle = useMutation({
    mutationFn: (paused: boolean) => apiSend('PUT', '/api/admin/simulator', { paused }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['simulator'] }); qc.invalidateQueries({ queryKey: ['overview'] }) },
  })
  const reset = useMutation({
    mutationFn: () => apiSend<{ anchorUtc: string }>('POST', '/api/admin/reset-demo', undefined),
    onSuccess: () => qc.invalidateQueries(),
  })

  return (
    <Page>
      <PageHeader eyebrow="System" title="Administration"
        description="Configuration status of every optional feature, the live data simulator, demo-data reset, users and the audit log." />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="Configuration status" icon={<Settings2 className="size-4" />}>
          {overview.isPending ? <Loading /> : overview.isError ? <ErrorState error={overview.error} /> : <ConfigStatus config={overview.data.config} />}
        </Panel>
        <Panel title="Live simulator and demo data" icon={<DatabaseZap className="size-4" />}>
          <div className="space-y-4 p-4 text-sm">
            {sim.data && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-sunken p-3">
                <span className={`size-2.5 rounded-full ${sim.data.paused ? 'bg-warn-fill' : 'live-dot bg-ok-fill'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-fg">Simulator <b className={sim.data.paused ? 'text-warn' : 'text-ok'}>{sim.data.paused ? 'Paused' : 'Running'}</b></p>
                  <p className="text-xs text-muted">Last reading {formatUtc(sim.data.lastReadingUtc)} · seed anchor {formatUtc(sim.data.anchorUtc)}</p>
                </div>
                {can('simulator.control') && (
                  <button onClick={() => toggle.mutate(!sim.data?.paused)} disabled={toggle.isPending} className="btn btn-secondary btn-sm">
                    {sim.data.paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
                    {sim.data.paused ? 'Resume simulator' : 'Pause simulator'}
                  </button>
                )}
              </div>
            )}
            {!can('simulator.control') ? <EmptyState icon={false}>Only an Administrator controls the simulator and demo data.</EmptyState> : (
              <div className="rounded-lg border border-crit/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-crit"><TriangleAlert className="size-3.5" aria-hidden="true" />Danger zone</p>
                <p className="mt-1 text-[11px] text-subtle">Deletes only rows with DataOrigin = Synthetic and the demo seed batch, in one transaction, then re-seeds. User-created rows are never touched.</p>
                <button disabled={reset.isPending} onClick={() => { if (window.confirm('Reset demo data? Synthetic demo rows are deleted and re-seeded (about 20 s). User-created rows are kept.')) reset.mutate() }}
                  className="btn btn-danger btn-sm mt-2">{reset.isPending ? 'Resetting… (about 20 s)' : 'Reset demo data'}</button>
                {reset.isSuccess && <p className="mt-1 text-xs text-ok">Demo data reset (anchor {formatUtc(reset.data.anchorUtc)}).</p>}
                {reset.isError && <p role="alert" className="mt-1 text-xs text-crit">{(reset.error as Error).message}</p>}
              </div>
            )}
            {toggle.isError && <p role="alert" className="text-xs text-crit">{(toggle.error as Error).message}</p>}
            <p className="flex items-center gap-1.5 text-[11px] text-subtle"><ShieldCheck className="size-3.5" aria-hidden="true" />Prototype — no security audit. Every write is role-checked and logged.</p>
          </div>
        </Panel>
      </div>
      {session && can('users.manage') && <Users self={session.email} />}
      {can('users.manage') && <RolesAndPermissions />}
      {can('audit.view') && (
        <Panel title="Audit log · latest 50" icon={<ScrollText className="size-4" />} className="overflow-x-auto">
          {audit.isPending ? <Loading /> : audit.isError ? <ErrorState error={audit.error} /> : (
            <table className="data-table text-xs">
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th></tr></thead>
              <tbody>{audit.data.map((a) => (
                <tr key={a.id}><td className="whitespace-nowrap text-muted">{formatUtc(a.timestampUtc)}</td><td>{a.userName}</td><td className="font-mono text-fg">{a.action}</td><td className="font-mono text-muted">{a.entityId}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Panel>
      )}
    </Page>
  )
}
