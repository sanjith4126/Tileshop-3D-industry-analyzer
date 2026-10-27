import { Box, ClipboardList, Layers, Search, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useInspectionZones, useObservations } from '../../api/hooks'
import { DemoBadge, EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { PRIORITY_CLASS, formatUtc } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { SummaryPanel } from './SummaryPanel'

const STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed']
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${PRIORITY_CLASS[priority]}`}>{priority}</span>
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
  const zoneBtn = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${active ? 'bg-accent/10 text-fg ring-1 ring-accent/35 ring-inset' : 'hover:bg-raised'}`

  return (
    <Page wide>
      <PageHeader eyebrow="Operations" title="Remote Site Inspection" badges={<DemoBadge />}
        description="Observations raised during site walk-downs, grouped by zone. Pick a zone to filter, open an observation for its corrective-action history, or highlight the zone in the 3D twin." />

      <div className="grid items-start gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <Panel title="Zones" icon={<Layers className="size-4" />}>
          {zones.isPending ? <Loading /> : zones.isError ? <ErrorState error={zones.error} onRetry={() => zones.refetch()} /> : (
            <ul className="space-y-0.5 p-2">
              <li>
                <button onClick={() => set('zone', '')} className={zoneBtn(!filters.zoneId)} aria-pressed={!filters.zoneId}>
                  <span className="flex-1 text-sm font-medium">All zones</span>
                  <span className="num text-xs text-subtle">{zones.data.reduce((n, z) => n + z.total, 0)}</span>
                </button>
              </li>
              {zones.data.map((z) => (
                <li key={z.id} className="group flex items-center gap-1">
                  <button onClick={() => set('zone', z.id)} className={zoneBtn(filters.zoneId === z.id)} aria-pressed={filters.zoneId === z.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{z.name}</span>
                      <span className="text-xs text-muted">{z.open} open · {z.total} total</span>
                    </span>
                    {z.openHighPriority > 0 && <span className={`chip ${PRIORITY_CLASS.High} border-0`} title="Open high or critical priority">{z.openHighPriority} high+</span>}
                  </button>
                  <button onClick={() => showIn3D(z.id)} className="icon-btn shrink-0" aria-label={`Show ${z.name} in 3D`} title="Show in 3D"><Box className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="min-w-0 space-y-5">
          <Panel title="Inspection summary" icon={<ClipboardList className="size-4" />}>
            <SummaryPanel key={filters.zoneId} zoneId={filters.zoneId || null} zoneName={zoneName} />
          </Panel>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-subtle" aria-hidden="true" />
              <input aria-label="Search observations" placeholder="Search description or machine…" value={filters.q} onChange={(e) => set('q', e.target.value)} className="input pl-8" />
            </div>
            <select aria-label="Status filter" value={filters.status} onChange={(e) => set('status', e.target.value)} className="input w-40">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Priority filter" value={filters.priority} onChange={(e) => set('priority', e.target.value)} className="input w-40">
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {(filters.status || filters.priority || filters.q) && (
              <button onClick={() => { const p = new URLSearchParams(params); ['status', 'priority', 'q'].forEach((k) => p.delete(k)); setParams(p, { replace: true }) }}
                className="btn btn-ghost btn-sm"><X className="size-3.5" aria-hidden="true" />Clear filters</button>
            )}
          </div>

          <Panel title={<>Observations · {zoneName} {obs.data && <span className="num font-normal text-subtle">{obs.data.length}</span>}</>} className="overflow-x-auto">
            {obs.isPending ? <Loading /> : obs.isError ? <ErrorState error={obs.error} onRetry={() => obs.refetch()} /> : obs.data.length === 0 ? <EmptyState>No observations match these filters.</EmptyState> : (
              <table className="data-table">
                <thead><tr><th>ID</th><th>Priority</th><th>Status</th><th>Observation</th><th>Zone</th><th>Assigned</th><th>Raised</th></tr></thead>
                <tbody>
                  {obs.data.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs whitespace-nowrap"><Link to={`/inspection/${o.id}`} className="link">{o.code}</Link></td>
                      <td><PriorityBadge priority={o.priority} /></td>
                      <td><span className="chip">{o.status}</span></td>
                      <td className="max-w-md">
                        <Link to={`/inspection/${o.id}`} className="text-fg hover:text-accent">{o.description}</Link>
                        <span className="block text-xs text-subtle">{o.category}{o.machineId ? ` · ${o.machineId}` : ''}{o.openActions ? ` · ${o.openActions} open action(s)` : ''}</span>
                      </td>
                      <td className="text-muted">{o.zoneName}</td>
                      <td className="text-muted">{o.assignedUser ?? o.assignedRole ?? '—'}</td>
                      <td className="whitespace-nowrap text-muted">{formatUtc(o.createdUtc).slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  )
}
