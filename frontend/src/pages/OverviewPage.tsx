import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMachines } from '../api/hooks'
import type { MachineStatus } from '../api/types'
import { DemoBadge, EmptyState, ErrorState, Loading, Panel } from '../components/States'
import { StatusBadge } from '../components/StatusBadge'
import { STATUS_META, STATUS_ORDER, formatUtc } from '../lib/status'
import { focusEntity } from '../store/focus'
import { ConfigStatus, useOverview } from './OverviewData'

function Tile({ to, label, value, sub, tone }: { to: string; label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <Link to={to} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 hover:border-slate-600">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
    </Link>
  )
}

export default function OverviewPage() {
  const machines = useMachines()
  const overview = useOverview()
  const navigate = useNavigate()
  const o = overview.data

  const showIn3D = (id: string) => {
    focusEntity(id)
    navigate('/twin')
  }

  const counts = STATUS_ORDER.map((s) => [s, machines.data?.filter((m) => m.status === s).length ?? 0] as [MachineStatus, number])
  const attention = (machines.data ?? [])
    .filter((m) => m.status !== 'Normal')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

  return (
    <div className="space-y-4 p-5">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Overview</h1>
        <DemoBadge />
        {o?.config.demoData && <span className="text-xs text-slate-500">Seeded {formatUtc(o.config.demoData.seededUtc)}</span>}
      </header>

      {machines.isError ? <ErrorState error={machines.error} onRetry={() => machines.refetch()} /> : (
        <section aria-label="Machines by status" className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {counts.map(([s, n]) => (
            <Link key={s} to={`/monitoring?status=${s}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 hover:border-slate-600">
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <span aria-hidden="true" style={{ color: STATUS_META[s].color }}>{STATUS_META[s].icon}</span>{STATUS_META[s].label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums" style={{ color: n ? STATUS_META[s].color : undefined }}>
                {machines.isPending ? '–' : n}
              </p>
            </Link>
          ))}
        </section>
      )}

      <section aria-label="Key indicators" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile to="/monitoring" label="Open threshold alerts" value={o ? o.openAlerts.total : '–'}
          sub={o && (o.openAlerts.critical > 0 ? `${o.openAlerts.critical} critical` : 'none critical')} tone={o?.openAlerts.critical ? 'text-red-300' : undefined} />
        <Tile to="/inspection?status=Open&priority=High" label="Open high/critical observations" value={o ? o.openHighPriorityObservations : '–'}
          sub="Remote site inspection" tone={o?.openHighPriorityObservations ? 'text-orange-300' : undefined} />
        <Tile to={o?.latestAnomaly ? `/predictive?machine=${o.latestAnomaly.machineId}` : '/predictive'} label="Latest ML anomaly"
          value={o ? (o.latestAnomaly ? <span className="font-mono text-base">{o.latestAnomaly.machineId}</span> : 'None') : '–'}
          sub={o?.latestAnomaly ? `score ${o.latestAnomaly.score.toFixed(3)} > ${o.latestAnomaly.threshold.toFixed(3)} · ${formatUtc(o.latestAnomaly.timestampUtc)}` : 'statistical, not a confirmed fault'} />
        <Tile to="/twin" label="3D digital twin" value={<span className="text-base text-cyan-300">Open twin →</span>} sub="16 machines · 5 zones (illustrative layout)" />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Machines needing attention" className="lg:col-span-2"
          actions={<Link to="/twin" className="text-xs text-cyan-300 hover:underline">Open 3D twin →</Link>}>
          {machines.isPending ? <Loading /> : attention.length === 0 ? <EmptyState>All machines report Normal.</EmptyState> : (
            <ul>
              {attention.map((m) => (
                <li key={m.id} className="flex items-center gap-3 border-t border-slate-800/70 px-3 py-2 first:border-0">
                  <StatusBadge status={m.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-mono text-xs text-slate-400">{m.id}</span> · {m.name}</p>
                    <p className="truncate text-xs text-slate-400">{m.statusReasons.join('; ')}{m.openAlertCount > 0 && ` · ${m.openAlertCount} open alert(s)`}</p>
                  </div>
                  <button onClick={() => showIn3D(m.id)} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Show in 3D</button>
                  <Link to={`/monitoring/${m.id}`} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Details</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Configuration status">
          {overview.isPending ? <Loading /> : overview.isError ? <ErrorState error={overview.error} onRetry={() => overview.refetch()} /> : <ConfigStatus config={overview.data.config} />}
        </Panel>
      </div>
    </div>
  )
}
