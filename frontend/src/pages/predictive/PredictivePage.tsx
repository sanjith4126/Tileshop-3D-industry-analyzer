import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { apiSend } from '../../api/client'
import { usePredictive, usePredictiveList, useReadings } from '../../api/hooks'
import { useAuth } from '../../auth/auth'
import { DemoBadge, ErrorState, Loading, Panel } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { formatUtc } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { AlertsList } from '../monitoring/AlertsList'
import { SensorChart } from '../monitoring/SensorChart'
import { ScoreCard } from './ScoreCard'

function SupportingCharts({ machineId, sensorIds }: { machineId: string; sensorIds: string[] }) {
  const q = useReadings(machineId, '24h')
  if (q.isPending) return <Loading label="Loading readings…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const shown = q.data.sensors.filter((s) => sensorIds.includes(s.sensorId))
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {(shown.length ? shown : q.data.sensors.slice(0, 2)).map((s) => <SensorChart key={s.sensorId} series={s} range="24h" />)}
    </div>
  )
}

function Detail({ machineId }: { machineId: string }) {
  const q = usePredictive(machineId)
  const { session } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const score = useMutation({
    mutationFn: () => apiSend('POST', `/api/predictive/${machineId}/score`, undefined, session?.token ?? null),
    onSettled: () => qc.invalidateQueries({ queryKey: ['predictive'] }),
  })
  if (q.isPending) return <Loading label="Loading analysis…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data
  const m = d.machine
  const chartIds = d.trends.filter((t) => t.trend?.notable || t.state !== 'Normal').map((t) => t.sensorId)

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{m.name}</h2>
        <span className="font-mono text-xs text-slate-400">{m.id}</span>
        <StatusBadge status={m.status} />
        {m.dataOrigin === 'Synthetic' && <DemoBadge />}
        <div className="ml-auto flex gap-2">
          <button onClick={() => { focusEntity(m.id); navigate('/twin') }} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Show in 3D</button>
          <Link to={`/monitoring/${m.id}`} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Monitoring →</Link>
        </div>
      </header>

      <p role="note" className="rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-semibold text-amber-200">{d.reviewLabel} No automatic equipment control.</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Pattern observed">
          <ul className="list-disc space-y-1 py-2 pr-3 pl-7 text-sm">{d.patternsObserved.map((p) => <li key={p}>{p}</li>)}</ul>
        </Panel>
        <Panel title="ML anomaly score" actions={session && (
          <button onClick={() => score.mutate()} disabled={score.isPending} className="rounded bg-slate-800 px-2 py-0.5 text-xs hover:bg-slate-700 disabled:opacity-50">
            {score.isPending ? 'Scoring…' : 'Score now'}
          </button>
        )}>
          <ScoreCard score={d.latestScore} ml={d.ml} />
          {score.isError && <p role="alert" className="px-3 pb-2 text-xs text-red-300">{(score.error as Error).message}</p>}
        </Panel>
      </div>

      <Panel title="Suggested inspection actions (rule table: docs/MAINTENANCE-RULES.md)">
        {d.suggestedActions.length === 0 ? <p className="p-3 text-sm text-slate-500">No rule triggered — no specific inspection suggested.</p> : (
          <ol className="space-y-1.5 p-3 text-sm">
            {d.suggestedActions.map((s) => (
              <li key={s.ruleId}><span className="font-mono text-xs text-cyan-300">{s.ruleId}</span> {s.action}<span className="block text-xs text-slate-500">because {s.trigger}</span></li>
            ))}
          </ol>
        )}
        <p className="border-t border-slate-800 px-3 py-2 text-xs text-amber-200">{d.reviewLabel}</p>
      </Panel>

      <section aria-label="Supporting readings" className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Supporting readings (24 h)</h3>
        <SupportingCharts machineId={m.id} sensorIds={chartIds} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Data-quality warnings">
          <ul className="list-disc space-y-1 py-2 pr-3 pl-7 text-sm text-amber-100/90">{d.dataQualityWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Panel>
        <Panel title="What this page does and does not do">
          <ul className="space-y-1 p-3 text-xs text-slate-300">
            <li><b>1. Threshold alert</b> — deterministic rule: a value crossed a limit.</li>
            <li><b>2. Statistical anomaly</b> — ML score: recent data is unusual, not necessarily faulty.</li>
            <li><b>3. Confirmed mechanical fault</b> — only a human records this (maintenance history).</li>
            <li><b>4. Failure prediction</b> — {d.failurePrediction}</li>
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Open alerts"><AlertsList machineId={m.id} /></Panel>
        <Panel title="Maintenance history">
          <ul>
            {d.maintenanceHistory.map((r) => (
              <li key={r.id} className="border-t border-slate-800/70 px-3 py-2 text-sm first:border-0">
                <p className="text-xs text-slate-400">{formatUtc(r.performedUtc)} · {r.type}</p>
                <p>{r.description}</p>{r.outcome && <p className="text-xs text-slate-400">→ {r.outcome}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

export default function PredictivePage() {
  const [params, setParams] = useSearchParams()
  const list = usePredictiveList()
  const selected = params.get('machine') ?? list.data?.find((m) => m.latestScore?.isAnomaly)?.machineId ?? list.data?.[0]?.machineId ?? null

  return (
    <div className="space-y-4 p-5">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Predictive Maintenance</h1>
        <DemoBadge />
      </header>
      <div className="grid gap-4 xl:grid-cols-[17rem_1fr]">
        <Panel title="Machines">
          {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
            <ul>
              {list.data.map((m) => (
                <li key={m.machineId}>
                  <button onClick={() => setParams({ machine: m.machineId })} aria-current={selected === m.machineId}
                    className={`flex w-full items-center gap-2 border-t border-slate-800/70 px-3 py-1.5 text-left text-sm hover:bg-slate-800/50 ${selected === m.machineId ? 'bg-slate-800/60' : ''}`}>
                    <StatusBadge status={m.status} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{m.machineId.replace('MACHINE-', '')}</span>
                    {m.latestScore?.isAnomaly && m.latestScore.isFresh && <span className="text-xs font-semibold text-amber-300" title="Statistical anomaly">⚑ anomaly</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {selected ? <Detail key={selected} machineId={selected} /> : <Loading />}
      </div>
    </div>
  )
}
