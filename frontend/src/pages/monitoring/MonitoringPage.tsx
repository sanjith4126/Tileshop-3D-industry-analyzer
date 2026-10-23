import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMachines } from '../../api/hooks'
import type { MachineStatus } from '../../api/types'
import { DemoBadge, EmptyState, ErrorState, Loading, Panel } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { STATUS_ORDER, formatUtc } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { AlertsList } from './AlertsList'

export default function MonitoringPage() {
  const q = useMachines()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') as MachineStatus | null
  const zone = params.get('zone')
  const search = params.get('q') ?? ''

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  const zones = [...new Map((q.data ?? []).map((m) => [m.zoneId, m.zoneName])).entries()]
  const rows = (q.data ?? [])
    .filter((m) => !status || m.status === status)
    .filter((m) => !zone || m.zoneId === zone)
    .filter((m) => !search || `${m.id} ${m.name} ${m.typeName}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.id.localeCompare(b.id))

  const select = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs'

  return (
    <div className="space-y-4 p-5">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Machine Monitoring</h1>
        <DemoBadge />
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <input aria-label="Search machines" placeholder="Search ID, name, type…" value={search} onChange={(e) => set('q', e.target.value)} className={`${select} w-56`} />
        <select aria-label="Status filter" value={status ?? ''} onChange={(e) => set('status', e.target.value)} className={select}>
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Zone filter" value={zone ?? ''} onChange={(e) => set('zone', e.target.value)} className={select}>
          <option value="">All zones</option>
          {zones.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        {(status || zone || search) && <button onClick={() => setParams({}, { replace: true })} className="text-xs text-cyan-300 hover:underline">Clear filters</button>}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={`Machines (${rows.length})`} className="overflow-x-auto xl:col-span-2">
          {q.isPending ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState>No machines match these filters.</EmptyState> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="px-3 py-2 font-normal">Status</th><th className="font-normal">Machine</th><th className="font-normal">Zone</th><th className="font-normal">Alerts</th><th className="font-normal">Last reading</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-t border-slate-800/70 hover:bg-slate-800/30">
                    <td className="px-3 py-2"><StatusBadge status={m.status} /></td>
                    <td><Link to={`/monitoring/${m.id}`} className="hover:underline"><span className="font-mono text-xs text-slate-400">{m.id}</span><br />{m.name}</Link></td>
                    <td className="text-xs">{m.zoneName}</td>
                    <td className="text-xs">{m.openAlertCount > 0 ? <span className="font-semibold text-amber-300">{m.openAlertCount} open</span> : '—'}</td>
                    <td className="text-xs text-slate-400">{formatUtc(m.lastReadingUtc)}</td>
                    <td className="pr-3 text-right">
                      <button onClick={() => { focusEntity(m.id); navigate('/twin') }} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Show in 3D</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Active alerts (all machines)">
          <AlertsList />
        </Panel>
      </div>
    </div>
  )
}
