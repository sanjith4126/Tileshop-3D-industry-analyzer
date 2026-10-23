import { Link } from 'react-router'
import { useMachine } from '../api/hooks'
import { DemoBadge, ErrorState, Loading } from '../components/States'
import { StatusBadge } from '../components/StatusBadge'
import { SENSOR_STATE_TO_STATUS, formatUtc, formatValue } from '../lib/status'

function limits(min: number | null, max: number | null) {
  if (min != null && max != null) return `${min}–${max}`
  if (max != null) return `≤ ${max}`
  if (min != null) return `≥ ${min}`
  return '—'
}

/** Side panel for the selected machine. All content is loaded from the API. */
export function MachinePanel({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useMachine(id)

  return (
    <aside aria-label="Selected machine" className="flex h-full w-96 shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-950/95">
      <header className="flex items-start justify-between gap-2 border-b border-slate-800 p-3">
        <div>
          <p className="font-mono text-xs text-slate-500">{id}</p>
          <h2 className="text-base font-semibold">{q.data?.machine.name ?? '…'}</h2>
        </div>
        <button onClick={onClose} aria-label="Close panel" className="rounded px-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100">✕</button>
      </header>

      {q.isPending && <Loading />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (() => {
        const { machine: m, sensors, recentMaintenance } = q.data
        return (
          <div className="space-y-4 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={m.status} size="md" />
              {m.dataOrigin === 'Synthetic' && <DemoBadge />}
            </div>
            {m.statusReasons.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-300">
                {m.statusReasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">Type</dt><dd>{m.typeName}</dd>
              <dt className="text-slate-500">Zone</dt><dd>{m.zoneName}</dd>
              <dt className="text-slate-500">Maintenance</dt><dd>{m.maintenanceStatus}</dd>
              <dt className="text-slate-500">Manufacturer</dt><dd>{m.manufacturer} · {m.model}</dd>
              <dt className="text-slate-500">Last reading</dt><dd>{formatUtc(m.lastReadingUtc)}</dd>
              <dt className="text-slate-500">Open alerts</dt><dd className={m.openAlertCount ? 'font-semibold text-amber-300' : ''}>{m.openAlertCount || 'None'}</dd>
            </dl>

            <section>
              <h3 className="mb-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">Latest readings</h3>
              <table className="w-full text-xs">
                <thead className="text-left text-slate-500">
                  <tr><th className="py-1 font-normal">Sensor</th><th className="font-normal">Value</th><th className="font-normal">Limits (warn)</th><th className="font-normal">State</th></tr>
                </thead>
                <tbody>
                  {sensors.map((s) => (
                    <tr key={s.id} className="border-t border-slate-800/70">
                      <td className="py-1">{s.measurement}</td>
                      <td className="font-mono">{formatValue(s.latestValue, s.unit)}</td>
                      <td className="font-mono text-slate-400">{limits(s.warningMin, s.warningMax)}</td>
                      <td>{s.state === 'Missing' ? <span className="text-purple-300">? Missing</span> : <StatusBadge status={SENSOR_STATE_TO_STATUS[s.state]} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] text-slate-500">Limits are illustrative demo values.</p>
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">Recent maintenance</h3>
              {recentMaintenance.length === 0 ? <p className="text-xs text-slate-500">No maintenance records.</p> : (
                <ul className="space-y-1.5 text-xs">
                  {recentMaintenance.slice(0, 4).map((r) => (
                    <li key={r.id} className="rounded bg-slate-900 p-2">
                      <p className="text-slate-400">{formatUtc(r.performedUtc)} · {r.type}</p>
                      <p>{r.description}</p>
                      {r.outcome && <p className="text-slate-400">→ {r.outcome}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Link to={`/monitoring/${encodeURIComponent(m.id)}`} className="inline-block rounded bg-cyan-700 px-3 py-1.5 text-xs font-semibold hover:bg-cyan-600">
              Open machine details →
            </Link>
          </div>
        )
      })()}
    </aside>
  )
}
