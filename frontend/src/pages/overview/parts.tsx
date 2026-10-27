import { ArrowUpRight, Box, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAlerts } from '../../api/hooks'
import type { MachineStatus, MachineSummary } from '../../api/types'
import { EmptyState, ErrorState, Loading } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { STATUS_META, STATUS_ORDER, ago, statusVar } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import type { ProductionDay } from '../OverviewData'

const byStatus = (a: MachineSummary, b: MachineSummary) =>
  STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.id.localeCompare(b.id)

/** One segment per machine, worst first — the whole fleet at a glance. */
export function FleetStrip({ machines }: { machines: MachineSummary[] }) {
  return (
    <ul className="flex h-3.5 gap-[2px] overflow-hidden rounded-[4px]" aria-label="Machines by status">
      {[...machines].sort(byStatus).map((m) => (
        <li key={m.id} className="flex-1">
          <Link to={`/monitoring/${m.id}`} title={`${m.id} · ${m.status}`} aria-label={`${m.name}: ${m.status}`}
            className="block h-full transition-[filter] hover:brightness-125" style={{ background: statusVar(m.status) }} />
        </li>
      ))}
    </ul>
  )
}

export function StatusCounts({ machines }: { machines: MachineSummary[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_ORDER.map((s) => {
        const n = machines.filter((m) => m.status === s).length
        const { Icon, label } = STATUS_META[s]
        return (
          <Link key={s} to={`/monitoring?status=${s}`} aria-label={`${n} ${label}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/70 px-2.5 py-1.5 text-xs transition-colors hover:border-line-strong ${n ? 'text-fg' : 'text-subtle'}`}>
            <Icon className="size-3.5" style={{ color: n ? statusVar(s) : undefined }} aria-hidden="true" />
            <span className="num text-sm font-semibold">{n}</span>
            <span className="text-muted">{label}</span>
          </Link>
        )
      })}
    </div>
  )
}

export function Kpi({ to, Icon, label, value, sub, tone = 'accent', i, children }: {
  to: string; Icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'crit' | 'warn' | 'serious' | 'ok'; i: number; children?: ReactNode
}) {
  const toneCls = { accent: 'bg-accent/10 text-accent', crit: 'bg-crit/12 text-crit', warn: 'bg-warn/12 text-warn', serious: 'bg-serious/12 text-serious', ok: 'bg-ok/10 text-ok' }[tone]
  return (
    <Link to={to} className="card reveal group flex flex-col p-4 transition-colors hover:border-line-strong" style={{ '--i': i } as CSSProperties}>
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{label}</span>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneCls}`}><Icon className="size-4" aria-hidden="true" /></span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="num text-[30px] leading-none font-semibold text-fg">{value}</p>
          {sub && <p className="mt-2 truncate text-xs text-muted">{sub}</p>}
        </div>
        {children}
      </div>
    </Link>
  )
}

/** Daily reject rate; each point has a hover tooltip (day, rate, units). */
export function RejectSparkline({ days }: { days: ProductionDay[] }) {
  if (days.length < 2) return null
  const max = Math.max(...days.map((d) => d.ratePercent)) * 1.15 || 1
  const pts = days.map((d, i) => [(i / (days.length - 1)) * 100, 30 - (d.ratePercent / max) * 26] as const)
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ')
  return (
    <svg viewBox="-3 -3 106 36" className="h-10 w-28 shrink-0 overflow-visible" role="img" aria-label={`Reject rate by day: ${days.map((d) => `${d.day} ${d.ratePercent}%`).join(', ')}`}>
      <polygon points={`0,30 ${line} 100,30`} style={{ fill: 'var(--series-1)', opacity: 0.12 }} />
      <polyline points={line} fill="none" style={{ stroke: 'var(--series-1)' }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => (
        <g key={days[i].day}>
          <circle cx={x} cy={y} r="7" fill="transparent"><title>{`${days[i].day}: ${days[i].ratePercent}% rejected (${days[i].rejected} of ${days[i].units})`}</title></circle>
          {i === pts.length - 1 && <circle cx={x} cy={y} r="2.6" style={{ fill: 'var(--series-1)', stroke: 'var(--surface)' }} strokeWidth="1.5" />}
        </g>
      ))}
    </svg>
  )
}

export function AttentionList({ machines }: { machines: MachineSummary[] }) {
  const navigate = useNavigate()
  const list = machines.filter((m) => m.status !== 'Normal').sort(byStatus)
  if (list.length === 0) return <EmptyState>All machines report Normal.</EmptyState>
  return (
    <ul className="divide-y divide-line/70">
      {list.map((m) => (
        <li key={m.id} className="flex items-center gap-4 px-4 py-3">
          <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: statusVar(m.status) }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-fg">{m.name}</span>
              <span className="font-mono text-xs text-subtle">{m.id}</span>
              <StatusBadge status={m.status} />
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {m.statusReasons.join(' · ')}{m.openAlertCount > 0 && <span className="text-warn"> · {m.openAlertCount} open alert(s)</span>}
            </p>
          </div>
          <button onClick={() => { focusEntity(m.id); navigate('/twin') }} className="btn btn-secondary btn-sm"><Box className="size-3.5" aria-hidden="true" />Show in 3D</button>
          <Link to={`/monitoring/${m.id}`} className="btn btn-ghost btn-sm" aria-label={`Details for ${m.id}`}>Details<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
        </li>
      ))}
    </ul>
  )
}

export function AlertsFeed() {
  const q = useAlerts()
  if (q.isPending) return <Loading label="Loading alerts…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const latest = [...q.data].sort((a, b) => Date.parse(b.detectedUtc) - Date.parse(a.detectedUtc)).slice(0, 5)
  if (latest.length === 0) return <EmptyState>No open threshold alerts.</EmptyState>
  return (
    <ol className="divide-y divide-line/70">
      {latest.map((a) => {
        const Icon = a.severity === 'Critical' ? OctagonAlert : TriangleAlert
        const s: MachineStatus = a.severity
        return (
          <li key={a.id}>
            <Link to={`/monitoring/${a.machineId}`} className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-raised/70">
              <Icon className="mt-0.5 size-4 shrink-0" style={{ color: statusVar(s) }} aria-label={a.severity} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-fg">{a.measurement} <span className="num text-muted">{a.observedValue} {a.unit}</span> <span className="text-subtle">› limit {a.threshold}</span></p>
                <p className="font-mono text-[11px] text-subtle">{a.machineId} · {a.status}</p>
              </div>
              <span className="shrink-0 text-[11px] text-subtle">{ago(a.detectedUtc)}</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
