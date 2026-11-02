import { ArrowUpRight, X } from 'lucide-react'
import { Link } from 'react-router'
import { useMachine } from '../api/hooks'
import { DemoBadge, ErrorState, Loading } from '../components/States'
import { StatusBadge } from '../components/StatusBadge'
import { SENSOR_STATE_TO_STATUS, STATUS_META, formatUtc, statusVar } from '../lib/status'

function limits(min: number | null, max: number | null) {
  if (min != null && max != null) return `${min}–${max}`
  if (max != null) return `≤ ${max}`
  if (min != null) return `≥ ${min}`
  return '—'
}

/** Side panel for the selected machine. All content is loaded from the API. */
export function MachinePanel({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useMachine(id)
  const status = q.data?.machine.status

  return (
    <aside aria-label="Selected machine" className="flex h-full w-95 shrink-0 flex-col overflow-y-auto border-l border-line bg-surface">
      <header className="relative border-b border-line px-4 pt-4 pb-3">
        {status && <span className="absolute inset-x-0 top-0 h-0.75" style={{ background: statusVar(status) }} aria-hidden="true" />}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-subtle">{id}</p>
            <h2 className="display truncate text-lg font-semibold">{q.data?.machine.name ?? '…'}</h2>
          </div>
          <button onClick={onClose} aria-label="Close panel" className="icon-btn -mr-1"><X className="size-4" /></button>
        </div>
        {q.data && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={q.data.machine.status} size="md" />
            {q.data.dataClassification === 'SYNTHETIC' && <DemoBadge />}
          </div>
        )}
      </header>

      {q.isPending && <Loading />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (() => {
        const { machine: m, sensors, recentMaintenance } = q.data
        return (
          <div className="space-y-5 p-4 text-sm">
            {m.statusReasons.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-line bg-raised/60 p-3 text-xs">
                {m.statusReasons.map((r) => <li key={r} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: statusVar(m.status) }} />{r}</li>)}
              </ul>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {[['Type', m.typeName], ['Zone', m.zoneName], ['Maintenance', m.maintenanceStatus], ['Open alerts', m.openAlertCount || 'None'],
                ['Manufacturer', m.manufacturer], ['Last reading', formatUtc(m.lastReadingUtc)]].map(([k, v]) => (
                <div key={k as string}><dt className="text-subtle">{k}</dt><dd className={`text-fg ${k === 'Open alerts' && m.openAlertCount ? 'font-semibold text-warn' : ''}`}>{v}</dd></div>
              ))}
            </dl>

            <section>
              <h3 className="eyebrow mb-2">Latest readings</h3>
              <ul className="grid grid-cols-2 gap-2">
                {sensors.map((s) => {
                  const st = SENSOR_STATE_TO_STATUS[s.state]
                  const { Icon } = STATUS_META[st]
                  return (
                    <li key={s.id} className="rounded-lg border border-line bg-raised/50 p-2.5">
                      <p className="flex items-center justify-between gap-1 text-[11px] text-muted">
                        <span className="truncate">{s.measurement}</span>
                        <Icon className="size-3.5 shrink-0" style={{ color: statusVar(st) }} aria-label={s.state} />
                      </p>
                      <p className="num mt-1 text-lg leading-tight font-semibold text-fg">
                        {s.latestValue == null ? <span className="text-sm text-unk">no data</span> : Number(s.latestValue.toFixed(2))}
                        {s.latestValue != null && <span className="ml-1 text-xs font-normal text-subtle">{s.unit}</span>}
                      </p>
                      <p className="font-mono text-[10px] text-subtle">warn {limits(s.warningMin, s.warningMax)}</p>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-1.5 text-[10px] text-subtle">Limits are illustrative demo values.</p>
            </section>

            <section>
              <h3 className="eyebrow mb-2">Recent maintenance</h3>
              {recentMaintenance === null ? <p className="text-xs text-subtle">Not available for your role.</p>
                : recentMaintenance.length === 0 ? <p className="text-xs text-subtle">No maintenance records.</p> : (
                <ol className="relative space-y-3 border-l border-line pl-4 text-xs">
                  {recentMaintenance.slice(0, 4).map((r) => (
                    <li key={r.id} className="relative">
                      <span className="absolute top-1 -left-5.25 size-2.5 rounded-full border-2 border-surface bg-line-strong" aria-hidden="true" />
                      <p className="text-subtle">{formatUtc(r.performedUtc)} · {r.type}</p>
                      <p className="text-fg">{r.description}</p>
                      {r.outcome && <p className="text-muted">→ {r.outcome}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <Link to={`/monitoring/${encodeURIComponent(m.id)}`} className="btn btn-primary w-full">
              Open machine details<ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )
      })()}
    </aside>
  )
}
