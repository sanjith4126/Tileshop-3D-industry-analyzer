import { Box, Gauge, Siren, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMachine, useReadings } from '../../api/hooks'
import type { ReadingsRange } from '../../api/types'
import { DemoBadge, EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { formatUtc, statusVar } from '../../lib/status'
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
  const bucket = readings.data?.bucketSeconds

  return (
    <Page wide>
      <PageHeader
        eyebrow={<><Link to="/monitoring" className="link">Machine Monitoring</Link> / <span className="font-mono normal-case">{m.id}</span></>}
        title={m.name}
        badges={<><StatusBadge status={m.status} size="md" />{m.dataClassification === 'SYNTHETIC' && <DemoBadge />}</>}
        description={`${m.typeName} · ${m.zoneName} · maintenance: ${m.maintenanceStatus} · last reading ${formatUtc(m.lastReadingUtc)}`}
        actions={<>
          <button onClick={() => { focusEntity(m.id); navigate('/twin') }} className="btn btn-secondary"><Box className="size-4" aria-hidden="true" />Show in 3D</button>
          <Link to={`/predictive?machine=${m.id}`} className="btn btn-primary"><Gauge className="size-4" aria-hidden="true" />Predictive maintenance</Link>
        </>}
      />

      {m.statusReasons.length > 0 && (
        <div className="card flex items-start gap-3 border-l-[3px] p-3 text-sm" style={{ borderLeftColor: statusVar(m.status) }}>
          <ul className="space-y-0.5 text-fg">{m.statusReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => <button key={r} role="radio" aria-checked={range === r} onClick={() => setRange(r)}>{r}</button>)}
        </div>
        {bucket != null && <span className="text-xs text-subtle">Server-side downsampled to {bucket >= 60 ? `${bucket / 60} min` : `${bucket} s`} buckets · line = average, band = min–max</span>}
      </div>

      {readings.isPending ? <Loading label="Loading readings…" /> : readings.isError ? <ErrorState error={readings.error} onRetry={() => readings.refetch()} /> : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {readings.data.sensors.map((s) => <SensorChart key={s.sensorId} series={s} range={range} />)}
        </div>
      )}
      <p className="text-[11px] text-subtle">Limit lines are illustrative demo values. Threshold alerts are deterministic rules: they say a value is out of range, not why.</p>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="Alerts for this machine" icon={<Siren className="size-4" />}><AlertsList machineId={m.id} /></Panel>
        <Panel title="Maintenance history" icon={<Wrench className="size-4" />}>
          {recentMaintenance.length === 0 ? <EmptyState>No maintenance records.</EmptyState> : (
            <ol className="relative m-4 space-y-4 border-l border-line pl-5">
              {recentMaintenance.map((r) => (
                <li key={r.id} className="relative text-sm">
                  <span className="absolute top-1 -left-6.5 size-2.5 rounded-full border-2 border-surface bg-line-strong" aria-hidden="true" />
                  <p className="text-xs text-subtle">{formatUtc(r.performedUtc)} · <span className="text-muted">{r.type}</span> · {r.durationHours} h · {r.performedBy}</p>
                  <p className="text-fg">{r.description}</p>
                  {r.outcome && <p className="text-xs text-muted">→ {r.outcome}</p>}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </Page>
  )
}
