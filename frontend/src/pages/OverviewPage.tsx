import { ArrowRight, BrainCircuit, Box, ClipboardCheck, Gauge, Siren, Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { useMachines } from '../api/hooks'
import { DemoBadge, ErrorState, Loading, Page, Panel } from '../components/States'
import { ago } from '../lib/status'
import { ConfigStatus, useOverview } from './OverviewData'
import { PlantBlueprint } from './overview/PlantBlueprint'
import { AlertsFeed, AttentionList, FleetStrip, Kpi, RejectSparkline, StatusCounts } from './overview/parts'

const reveal = (i: number) => ({ '--i': i }) as CSSProperties

function summary(machines: { status: string }[]) {
  const n = (s: string) => machines.filter((m) => m.status === s).length
  const parts = [
    n('Critical') && `${n('Critical')} critical`,
    n('Warning') && `${n('Warning')} in warning`,
    n('Unknown') && `${n('Unknown')} with missing data`,
    n('Offline') && `${n('Offline')} offline`,
  ].filter(Boolean)
  return parts.length ? `${parts.join(', ')}.` : 'No machine needs attention.'
}

export default function OverviewPage() {
  const machines = useMachines()
  const overview = useOverview()
  const o = overview.data
  const list = machines.data ?? []
  const normal = list.filter((m) => m.status === 'Normal').length
  const pct = list.length ? Math.round((normal / list.length) * 100) : null
  const asOf = machines.dataUpdatedAt || overview.dataUpdatedAt

  return (
    <Page wide>
      {/* Hero */}
      <section className="card reveal relative overflow-hidden" style={reveal(0)}>
        <div className="bg-blueprint absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-8 p-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:p-8">
          <div className="flex min-w-0 flex-col">
            <p className="eyebrow flex items-center gap-2">
              <span className="live-dot size-1.5 rounded-full bg-ok" aria-hidden="true" />
              Live plant status{asOf > 0 && ` · as of ${new Date(asOf).toISOString().slice(0, 16).replace('T', ' ')} UTC`}
            </p>
            <h1 className="display mt-3 text-[40px] leading-[1.02] font-semibold text-fg">
              TileTwin <span className="block text-muted">Demonstration Facility</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2"><DemoBadge /><span className="text-xs text-subtle">Fictional plant · synthetic data · illustrative layout</span></div>

            {machines.isError ? <ErrorState error={machines.error} onRetry={() => machines.refetch()} /> : (
              <>
                <div className="mt-7 flex items-end gap-5">
                  <p className="num text-[76px] leading-[0.85] font-semibold tracking-tight text-fg">
                    {pct ?? '–'}<span className="text-3xl text-subtle">%</span>
                  </p>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-fg">of the fleet running normally</p>
                    <p className="text-sm text-muted">{machines.isPending ? 'Loading machines…' : `${normal} of ${list.length} machines · ${summary(list)}`}</p>
                  </div>
                </div>
                <div className="mt-5"><FleetStrip machines={list} /></div>
                <div className="mt-4"><StatusCounts machines={list} /></div>
              </>
            )}

            <div className="mt-auto flex flex-wrap gap-2 pt-7">
              <Link to="/twin" className="btn btn-primary btn-lg"><Box className="size-4" aria-hidden="true" />Open 3D twin</Link>
              <Link to="/predictive" className="btn btn-secondary btn-lg"><Gauge className="size-4" aria-hidden="true" />Prioritise maintenance</Link>
              <Link to="/assistant" className="btn btn-ghost btn-lg"><Sparkles className="size-4" aria-hidden="true" />Ask the assistant<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-line bg-surface/70 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow">Plant layout · live status</p>
              <p className="text-[11px] text-subtle">Select a machine or zone to open it in 3D</p>
            </div>
            <PlantBlueprint machines={list} />
          </div>
        </div>
      </section>

      {/* Key indicators */}
      <section aria-label="Key indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi i={1} to="/monitoring" Icon={Siren} label="Open threshold alerts" tone={o?.openAlerts.critical ? 'crit' : 'warn'}
          value={o ? o.openAlerts.total : '–'} sub={o ? `${o.openAlerts.critical} critical · ${o.openAlerts.total - o.openAlerts.critical} warning` : ' '} />
        <Kpi i={2} to="/inspection?status=Open&priority=High" Icon={ClipboardCheck} label="High-priority observations" tone="serious"
          value={o ? o.openHighPriorityObservations : '–'} sub="Open · remote site inspection" />
        <Kpi i={3} to={o?.latestAnomaly ? `/predictive?machine=${o.latestAnomaly.machineId}` : '/predictive'} Icon={BrainCircuit} label="Latest ML anomaly" tone="accent"
          value={o?.latestAnomaly ? <span className="font-mono text-xl">{o.latestAnomaly.machineId}</span> : o ? 'None' : '–'}
          sub={o?.latestAnomaly ? `flagged ${ago(o.latestAnomaly.timestampUtc)} · not a confirmed fault` : 'Statistical — not a confirmed fault'} />
        <Kpi i={4} to="/reports" Icon={Gauge} label="Reject rate · 7 days" tone="ok"
          value={o?.production ? <>{o.production.ratePercent.toFixed(2)}<span className="text-lg text-subtle">%</span></> : '–'}
          sub={o?.production ? `${o.production.rejected.toLocaleString()} of ${o.production.units.toLocaleString()} tiles` : ' '}>
          {o?.production && <RejectSparkline days={o.production.days} />}
        </Kpi>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="reveal space-y-4 xl:col-span-2" style={reveal(5)}>
          <Panel title="Needs attention" icon={<Siren className="size-4" />}
            actions={<Link to="/monitoring" className="link text-xs">All machines →</Link>}>
            {machines.isPending ? <Loading /> : <AttentionList machines={list} />}
          </Panel>
          <Panel title="Latest alerts" actions={<Link to="/monitoring" className="link text-xs">Monitoring →</Link>}>
            <AlertsFeed />
          </Panel>
        </div>
        <div className="reveal" style={reveal(6)}>
          <Panel title="System status">
            {overview.isPending ? <Loading /> : overview.isError ? <ErrorState error={overview.error} onRetry={() => overview.refetch()} /> : <ConfigStatus config={overview.data.config} />}
          </Panel>
        </div>
      </div>
    </Page>
  )
}
