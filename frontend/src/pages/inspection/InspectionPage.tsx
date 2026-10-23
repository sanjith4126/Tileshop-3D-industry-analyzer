import { Link, useNavigate, useSearchParams } from 'react-router'
import { useInspectionZones, useObservations } from '../../api/hooks'
import { DemoBadge, EmptyState, ErrorState, Loading, Panel } from '../../components/States'
import { PRIORITY_CLASS, formatUtc } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { SummaryPanel } from './SummaryPanel'

const STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed']
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${PRIORITY_CLASS[priority]}`}>{priority}</span>
}

export default function InspectionPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const filters = { zoneId: params.get('zone') ?? '', status: params.get('status') ?? '', priority: params.get('priority') ?? '', q: params.get('q') ?? '' }
  const zones = useInspectionZones()
  const obs = useObservations(filters)
  const zoneName = zones.data?.find((z) => z.id === filters.zoneId)?.name ?? 'All zones'

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }
  const showIn3D = (id: string) => { focusEntity(id); navigate('/twin') }
  const select = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs'

  return (
    <div className="space-y-4 p-5">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Remote Site Inspection</h1>
        <DemoBadge />
      </header>

      <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <Panel title="Zones">
          {zones.isPending ? <Loading /> : zones.isError ? <ErrorState error={zones.error} onRetry={() => zones.refetch()} /> : (
            <ul>
              <li>
                <button onClick={() => set('zone', '')} className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800/50 ${!filters.zoneId ? 'bg-slate-800/60' : ''}`}>All zones</button>
              </li>
              {zones.data.map((z) => (
                <li key={z.id} className={`flex items-center border-t border-slate-800/70 ${filters.zoneId === z.id ? 'bg-slate-800/60' : ''}`}>
                  <button onClick={() => set('zone', z.id)} className="flex-1 px-3 py-2 text-left hover:bg-slate-800/50" aria-pressed={filters.zoneId === z.id}>
                    <span className="block text-sm">{z.name}</span>
                    <span className="text-xs text-slate-400">{z.open} open · {z.total} total</span>
                    {z.openHighPriority > 0 && <span className="ml-2 text-xs font-semibold text-orange-300">▲ {z.openHighPriority} high/critical</span>}
                  </button>
                  <button onClick={() => showIn3D(z.id)} className="mr-2 rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700" aria-label={`Show ${z.name} in 3D`}>3D</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel title={`Inspection summary`}>
            <SummaryPanel key={filters.zoneId} zoneId={filters.zoneId || null} zoneName={zoneName} />
          </Panel>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
            <input aria-label="Search observations" placeholder="Search description or machine…" value={filters.q} onChange={(e) => set('q', e.target.value)} className={`${select} w-64`} />
            <select aria-label="Status filter" value={filters.status} onChange={(e) => set('status', e.target.value)} className={select}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Priority filter" value={filters.priority} onChange={(e) => set('priority', e.target.value)} className={select}>
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {(filters.status || filters.priority || filters.q) && (
              <button onClick={() => { set('status', ''); set('priority', ''); set('q', '') }} className="text-xs text-cyan-300 hover:underline">Clear filters</button>
            )}
          </div>

          <Panel title={`Observations — ${zoneName}${obs.data ? ` (${obs.data.length})` : ''}`} className="overflow-x-auto">
            {obs.isPending ? <Loading /> : obs.isError ? <ErrorState error={obs.error} onRetry={() => obs.refetch()} /> : obs.data.length === 0 ? <EmptyState>No observations match these filters.</EmptyState> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr><th className="px-3 py-2 font-normal">ID</th><th className="font-normal">Priority</th><th className="font-normal">Status</th><th className="font-normal">Observation</th><th className="font-normal">Zone</th><th className="font-normal">Assigned</th><th className="font-normal">Raised</th></tr>
                </thead>
                <tbody>
                  {obs.data.map((o) => (
                    <tr key={o.id} className="border-t border-slate-800/70 hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-mono text-xs"><Link to={`/inspection/${o.id}`} className="text-cyan-300 hover:underline">{o.code}</Link></td>
                      <td><PriorityBadge priority={o.priority} /></td>
                      <td className="text-xs">{o.status}</td>
                      <td className="max-w-md py-2"><Link to={`/inspection/${o.id}`} className="hover:underline">{o.description}</Link>
                        <span className="block text-xs text-slate-500">{o.category}{o.machineId ? ` · ${o.machineId}` : ''}{o.openActions ? ` · ${o.openActions} open action(s)` : ''}</span></td>
                      <td className="text-xs">{o.zoneName}</td>
                      <td className="text-xs text-slate-400">{o.assignedUser ?? o.assignedRole ?? '—'}</td>
                      <td className="pr-3 text-xs whitespace-nowrap text-slate-400">{formatUtc(o.createdUtc).slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
