import { ArrowUpRight, Box, Search, Siren, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMachines } from '../../api/hooks'
import type { MachineStatus } from '../../api/types'
import { DemoBadge, EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { STATUS_META, STATUS_ORDER, ago, formatUtc, statusVar } from '../../lib/status'
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

  const all = q.data ?? []
  const zones = [...new Map(all.map((m) => [m.zoneId, m.zoneName])).entries()]
  const rows = all
    .filter((m) => !status || m.status === status)
    .filter((m) => !zone || m.zoneId === zone)
    .filter((m) => !search || `${m.id} ${m.name} ${m.typeName}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.id.localeCompare(b.id))

  return (
    <Page wide>
      <PageHeader eyebrow="Operations" title="Machine Monitoring" badges={<DemoBadge />}
        description="Status is computed from each machine's latest sensor readings against its limits. Missing data shows as Unknown — never as Normal." />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-subtle" aria-hidden="true" />
          <input aria-label="Search machines" placeholder="Search ID, name, type…" value={search} onChange={(e) => set('q', e.target.value)} className="input pl-8" />
        </div>
        <div className="segmented" role="radiogroup" aria-label="Status filter">
          <button role="radio" aria-checked={!status} onClick={() => set('status', '')}>All <span className="num text-subtle">{all.length}</span></button>
          {STATUS_ORDER.map((s) => {
            const { Icon, label } = STATUS_META[s]
            return (
              <button key={s} role="radio" aria-checked={status === s} onClick={() => set('status', s)}>
                <Icon className="size-3.5" style={{ color: statusVar(s) }} aria-hidden="true" />{label}
                <span className="num text-subtle">{all.filter((m) => m.status === s).length}</span>
              </button>
            )
          })}
        </div>
        <select aria-label="Zone filter" value={zone ?? ''} onChange={(e) => set('zone', e.target.value)} className="input w-52">
          <option value="">All zones</option>
          {zones.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        {(status || zone || search) && <button onClick={() => setParams({}, { replace: true })} className="btn btn-ghost btn-sm"><X className="size-3.5" aria-hidden="true" />Clear filters</button>}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel title={<>Machines <span className="num font-normal text-subtle">{rows.length}</span></>} className="overflow-x-auto">
          {q.isPending ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState>No machines match these filters.</EmptyState> : (
            <table className="data-table">
              <thead><tr><th>Status</th><th>Machine</th><th>Zone</th><th>Alerts</th><th>Last reading</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td><StatusBadge status={m.status} /></td>
                    <td>
                      <Link to={`/monitoring/${m.id}`} className="group block">
                        <span className="block font-medium text-fg group-hover:text-accent">{m.name}</span>
                        <span className="font-mono text-[11px] text-subtle">{m.id} · {m.typeName}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-muted">{m.zoneName}</td>
                    <td className="whitespace-nowrap">{m.openAlertCount > 0
                      ? <span className="inline-flex items-center gap-1 font-semibold text-warn"><Siren className="size-3.5" aria-hidden="true" />{m.openAlertCount} open</span>
                      : <span className="text-subtle">—</span>}</td>
                    <td className="whitespace-nowrap text-muted" title={formatUtc(m.lastReadingUtc)}>{ago(m.lastReadingUtc)}</td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => { focusEntity(m.id); navigate('/twin') }} className="btn btn-ghost btn-sm"><Box className="size-3.5" aria-hidden="true" />Show in 3D</button>
                      <Link to={`/monitoring/${m.id}`} className="icon-btn size-7" aria-label={`Open ${m.name}`}><ArrowUpRight className="size-4" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Active alerts" icon={<Siren className="size-4" />} actions={<span className="text-[11px] text-subtle">rule-based thresholds</span>}>
          <AlertsList />
        </Panel>
      </div>
    </Page>
  )
}
