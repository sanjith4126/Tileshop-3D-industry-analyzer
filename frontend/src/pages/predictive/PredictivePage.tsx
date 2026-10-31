import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity, BrainCircuit, Box, FileText, Flag, Info, ListChecks, RefreshCw, ScanLine, ShieldAlert, Siren, Wrench } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { apiSend } from '../../api/client'
import { usePredictive, usePredictiveList, useReadings } from '../../api/hooks'
import { useAuth } from '../../auth/auth'
import { DemoBadge, EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { STATUS_META, formatUtc, shortId, statusVar } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { AlertsList } from '../monitoring/AlertsList'
import { SensorChart } from '../monitoring/SensorChart'
import { PrioritisationPanel } from './PrioritisationPanel'
import { ScoreCard } from './ScoreCard'

function SupportingCharts({ machineId, sensorIds }: { machineId: string; sensorIds: string[] }) {
  const q = useReadings(machineId, '24h')
  if (q.isPending) return <Loading label="Loading readings…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const shown = q.data.sensors.filter((s) => sensorIds.includes(s.sensorId))
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(shown.length ? shown : q.data.sensors.slice(0, 2)).map((s) => <SensorChart key={s.sensorId} series={s} range="24h" />)}
    </div>
  )
}

const KINDS = [
  ['1. Threshold alert', 'deterministic rule: a value crossed a limit.'],
  ['2. Statistical anomaly', 'ML score: recent data is unusual, not necessarily faulty.'],
  ['3. Confirmed mechanical fault', 'only a human records this (maintenance history).'],
] as const

function Detail({ machineId }: { machineId: string }) {
  const q = usePredictive(machineId)
  const { session } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const score = useMutation({
    mutationFn: () => apiSend('POST', `/api/predictive/${machineId}/score`, undefined),
    onSettled: () => qc.invalidateQueries({ queryKey: ['predictive'] }),
  })
  if (q.isPending) return <Loading label="Loading analysis…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data
  const m = d.machine
  const chartIds = d.trends.filter((t) => t.trend?.notable || t.state !== 'Normal').map((t) => t.sensorId)

  return (
    <div className="min-w-0 space-y-5">
      <header className="card relative overflow-hidden p-4">
        <span className="absolute inset-y-0 left-0 w-0.75" style={{ background: statusVar(m.status) }} aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-subtle">{m.id}</p>
            <h2 className="display text-xl font-semibold text-fg">{m.name}</h2>
          </div>
          <StatusBadge status={m.status} size="md" />
          {m.dataClassification === 'SYNTHETIC' && <DemoBadge />}
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={() => { focusEntity(m.id); navigate('/twin') }} className="btn btn-secondary btn-sm"><Box className="size-3.5" aria-hidden="true" />Show in 3D</button>
            <Link to={`/monitoring/${m.id}`} className="btn btn-secondary btn-sm"><Activity className="size-3.5" aria-hidden="true" />Monitoring</Link>
            <Link to={`/reports?type=MachineAnomalies&machine=${m.id}`} className="btn btn-secondary btn-sm"><FileText className="size-3.5" aria-hidden="true" />Anomaly report (PDF)</Link>
          </div>
        </div>
      </header>

      <p role="note" className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/8 px-4 py-2.5 text-sm font-semibold text-warn">
        <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />{d.reviewLabel} No automatic equipment control.
      </p>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel title="ML anomaly score" icon={<BrainCircuit className="size-4" />} actions={session && (
          <button onClick={() => score.mutate()} disabled={score.isPending} className="btn btn-secondary btn-sm">
            <RefreshCw className={`size-3.5 ${score.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />{score.isPending ? 'Scoring…' : 'Score now'}
          </button>
        )}>
          <ScoreCard score={d.latestScore} ml={d.ml} history={d.scoreHistory} />
          {score.isError && <p role="alert" className="px-4 pb-3 text-xs text-crit">{(score.error as Error).message}</p>}
        </Panel>
        <div className="space-y-5">
          <Panel title="Pattern observed" icon={<ScanLine className="size-4" />}>
            <ul className="space-y-1.5 p-4 text-sm text-fg">
              {d.patternsObserved.map((p) => <li key={p} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />{p}</li>)}
            </ul>
          </Panel>
          <Panel title="Suggested inspection actions" icon={<ListChecks className="size-4" />} actions={<span className="font-mono text-[10px] text-subtle">docs/MAINTENANCE-RULES.md</span>}>
            {d.suggestedActions.length === 0 ? <EmptyState icon={false}>No rule triggered — no specific inspection suggested.</EmptyState> : (
              <ol className="space-y-2.5 p-4 text-sm">
                {d.suggestedActions.map((s) => (
                  <li key={s.ruleId} className="flex gap-3">
                    <span className="chip h-fit shrink-0 font-mono text-accent">{s.ruleId}</span>
                    <span className="text-fg">{s.action}<span className="block text-xs text-subtle">because {s.trigger}</span></span>
                  </li>
                ))}
              </ol>
            )}
            <p className="border-t border-line bg-sunken/60 px-4 py-2 text-xs font-medium text-warn">{d.reviewLabel}</p>
          </Panel>
        </div>
      </div>

      <section aria-label="Supporting readings" className="space-y-2">
        <h3 className="eyebrow">Supporting readings · 24 h</h3>
        <SupportingCharts machineId={m.id} sensorIds={chartIds} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel title="Data-quality warnings" icon={<Info className="size-4" />}>
          {d.dataQualityWarnings.length === 0 ? <EmptyState icon={false}>No data-quality issues detected.</EmptyState> : (
            <ul className="space-y-1.5 p-4 text-sm text-warn">{d.dataQualityWarnings.map((w) => <li key={w} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-warn" aria-hidden="true" />{w}</li>)}</ul>
          )}
        </Panel>
        <Panel title="What this page does and does not do" icon={<Info className="size-4" />}>
          <dl className="space-y-2 p-4 text-xs">
            {KINDS.map(([k, v]) => <div key={k}><dt className="inline font-semibold text-fg">{k}</dt> <dd className="inline text-muted">— {v}</dd></div>)}
            <div><dt className="inline font-semibold text-fg">4. Failure prediction</dt> <dd className="inline text-muted">— {d.failurePrediction}</dd></div>
          </dl>
        </Panel>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel title="Open alerts" icon={<Siren className="size-4" />}><AlertsList machineId={m.id} /></Panel>
        <Panel title="Maintenance history" icon={<Wrench className="size-4" />}>
          {d.maintenanceHistory.length === 0 ? <EmptyState>No maintenance records.</EmptyState> : (
            <ol className="relative m-4 space-y-3 border-l border-line pl-5">
              {d.maintenanceHistory.map((r) => (
                <li key={r.id} className="relative text-sm">
                  <span className="absolute top-1 -left-6.5 size-2.5 rounded-full border-2 border-surface bg-line-strong" aria-hidden="true" />
                  <p className="text-xs text-subtle">{formatUtc(r.performedUtc)} · {r.type}</p>
                  <p className="text-fg">{r.description}</p>{r.outcome && <p className="text-xs text-muted">→ {r.outcome}</p>}
                </li>
              ))}
            </ol>
          )}
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
    <Page wide>
      <PageHeader eyebrow="Quality & reliability" title="Predictive Maintenance" badges={<DemoBadge />}
        description="Statistical anomaly scores and rule-based inspection suggestions for each machine, with the evidence behind them. Every suggestion requires review by a qualified engineer." />
      <PrioritisationPanel />
      <div className="grid items-start gap-5 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <Panel title="Machines" className="xl:sticky xl:top-4">
          {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
            <ul className="space-y-0.5 p-2">
              {list.data.map((m) => {
                const active = selected === m.machineId
                const { Icon } = STATUS_META[m.status]
                const flagged = m.latestScore?.isAnomaly && m.latestScore.isFresh
                return (
                  <li key={m.machineId}>
                    <button onClick={() => setParams({ machine: m.machineId })} aria-current={active}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${active ? 'bg-accent/10 ring-1 ring-accent/35 ring-inset' : 'hover:bg-raised'}`}>
                      <Icon className="size-4 shrink-0" style={{ color: statusVar(m.status) }} aria-label={m.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs text-fg">{shortId(m.machineId)}</span>
                        <span className="block truncate text-[11px] text-subtle">{m.name}</span>
                      </span>
                      {flagged && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warn" title="Statistical anomaly"><Flag className="size-3" aria-hidden="true" />anomaly</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
        {selected ? <Detail key={selected} machineId={selected} /> : <Loading />}
      </div>
    </Page>
  )
}
