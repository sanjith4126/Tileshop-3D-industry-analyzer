import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMachine, useReadings } from '../../api/hooks'
import type { ReadingsRange } from '../../api/types'
import { DemoBadge, ErrorState, Loading, Panel } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { formatUtc } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { AlertsList } from './AlertsList'
import { SensorChart } from './SensorChart'

const RANGES: ReadingsRange[] = ['1h', '24h', '7d']

export default function MachineDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [range, setRange] = useState<ReadingsRange>('24h')
  const machine = useMachine(id)
  const readings = useReadings(id, range)

  if (machine.isPending) return <Loading label="Loading machine…" />
  if (machine.isError) return <ErrorState error={machine.error} onRetry={() => machine.refetch()} />
  const { machine: m, recentMaintenance } = machine.data

  return (
    <div className="space-y-4 p-5">
      <nav className="text-xs text-slate-400"><Link to="/monitoring" className="hover:underline">Machine Monitoring</Link> / {m.id}</nav>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{m.name}</h1>
        <span className="font-mono text-xs text-slate-400">{m.id}</span>
        <StatusBadge status={m.status} size="md" />
        {m.dataOrigin === 'Synthetic' && <DemoBadge />}
        <button onClick={() => { focusEntity(m.id); navigate('/twin') }} className="ml-auto rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Show in 3D</button>
        <Link to={`/predictive?machine=${m.id}`} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Predictive maintenance →</Link>
      </header>
      {m.statusReasons.length > 0 && <p className="text-sm text-slate-300">{m.statusReasons.join(' · ')}</p>}
      <p className="text-xs text-slate-500">{m.typeName} · {m.zoneName} · maintenance: {m.maintenanceStatus} · last reading {formatUtc(m.lastReadingUtc)}</p>

      <div className="flex items-center gap-2" role="radiogroup" aria-label="Time range">
        <span className="text-xs text-slate-400">Range</span>
        {RANGES.map((r) => (
          <button key={r} role="radio" aria-checked={range === r} onClick={() => setRange(r)}
            className={`rounded px-2.5 py-1 text-xs ${range === r ? 'bg-cyan-700 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}>{r}</button>
        ))}
        {readings.data && <span className="text-xs text-slate-500">server-side downsampled to {readings.data.bucketSeconds >= 60 ? `${readings.data.bucketSeconds / 60} min` : `${readings.data.bucketSeconds} s`} buckets (avg line, min–max band)</span>}
      </div>

      {readings.isPending ? <Loading label="Loading readings…" /> : readings.isError ? <ErrorState error={readings.error} onRetry={() => readings.refetch()} /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {readings.data.sensors.map((s) => <SensorChart key={s.sensorId} series={s} range={range} />)}
        </div>
      )}
      <p className="text-[11px] text-slate-500">Limit lines are illustrative demo values. Threshold alerts are deterministic rules; they say a value is out of range, not why.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Alerts for this machine"><AlertsList machineId={m.id} /></Panel>
        <Panel title="Maintenance history">
          <ul>
            {recentMaintenance.map((r) => (
              <li key={r.id} className="border-t border-slate-800/70 px-3 py-2 text-sm first:border-0">
                <p className="text-xs text-slate-400">{formatUtc(r.performedUtc)} · {r.type} · {r.durationHours} h · {r.performedBy}</p>
                <p>{r.description}</p>
                {r.outcome && <p className="text-xs text-slate-400">→ {r.outcome}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
