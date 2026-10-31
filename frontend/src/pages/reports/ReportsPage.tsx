import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BrainCircuit, ClipboardCheck, Download, Factory, FilePlus2, Files, Wrench, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { apiSend } from '../../api/client'
import { useMachines, useReports, useZones } from '../../api/hooks'
import type { Report, ReportType } from '../../api/types'
import { useAuth } from '../../auth/auth'
import { DemoBadge, EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { ago, formatUtc } from '../../lib/status'

const REPORT_TYPES: { type: ReportType; label: string; blurb: string; Icon: LucideIcon; filter: 'machine' | 'zone' | null }[] = [
  { type: 'FactoryHealth', label: 'Factory health', blurb: 'Status, alerts and anomalies across the plant', Icon: Factory, filter: null },
  { type: 'MachineAnomalies', label: 'Machine anomalies', blurb: 'ML anomaly scores and threshold alerts', Icon: BrainCircuit, filter: 'machine' },
  { type: 'MaintenanceHistory', label: 'Maintenance history', blurb: 'Recorded work against open alerts', Icon: Wrench, filter: 'machine' },
  { type: 'SiteInspection', label: 'Site inspection', blurb: 'Observations and corrective actions', Icon: ClipboardCheck, filter: 'zone' },
]
const ICON = Object.fromEntries(REPORT_TYPES.map((t) => [t.type, t.Icon])) as Record<ReportType, LucideIcon>
const PERIODS = [{ label: '24 h', days: 1 }, { label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }]

export default function ReportsPage() {
  const [params] = useSearchParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const reports = useReports()
  const machines = useMachines()
  const zones = useZones()
  const [type, setType] = useState<ReportType>((params.get('type') as ReportType) ?? 'FactoryHealth')
  const [days, setDays] = useState(7)
  const [machineId, setMachineId] = useState(params.get('machine') ?? '')
  const [zoneId, setZoneId] = useState('')
  const filter = REPORT_TYPES.find((t) => t.type === type)!.filter

  const create = useMutation({
    mutationFn: () => {
      const to = new Date()
      const from = new Date(to.getTime() - days * 86_400_000)
      return apiSend<Report>('POST', '/api/reports', {
        type, fromUtc: from.toISOString(), toUtc: to.toISOString(),
        machineId: filter === 'machine' && machineId ? machineId : null, zoneId: filter === 'zone' && zoneId ? zoneId : null,
      })
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      navigate(`/reports/${r.id}`)
    },
  })

  return (
    <Page>
      <PageHeader eyebrow="Intelligence" title="Reports" badges={<DemoBadge />}
        description="Built only from database records — viewable in the browser and as PDF. An empty period produces a valid “no records” report." />

      <Panel title="Generate report" icon={<FilePlus2 className="size-4" />}>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-4 p-4">
          <div role="radiogroup" aria-label="Report type" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {REPORT_TYPES.map(({ type: t, label, blurb, Icon }) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
                className={`flex gap-3 rounded-xl border p-3 text-left transition-colors ${type === t ? 'border-accent bg-accent/8 ring-1 ring-accent/40' : 'border-line bg-raised/40 hover:border-line-strong'}`}>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${type === t ? 'bg-accent-strong text-on-accent' : 'bg-raised text-muted'}`}><Icon className="size-4" aria-hidden="true" /></span>
                <span><span className="block text-sm font-semibold text-fg">{label}</span><span className="block text-xs text-muted">{blurb}</span></span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="field-label" id="period-label">Period</span>
              <div className="segmented" role="radiogroup" aria-labelledby="period-label">
                {PERIODS.map((p) => <button key={p.days} type="button" role="radio" aria-checked={days === p.days} onClick={() => setDays(p.days)}>{p.label}</button>)}
              </div>
            </div>
            {filter === 'machine' && (
              <label className="w-72"><span className="field-label">Machine (optional)</span>
                <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="input">
                  <option value="">All machines</option>
                  {machines.data?.map((m) => <option key={m.id} value={m.id}>{m.id} — {m.name}</option>)}
                </select>
              </label>
            )}
            {filter === 'zone' && (
              <label className="w-72"><span className="field-label">Zone (optional)</span>
                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="input">
                  <option value="">All zones</option>
                  {zones.data?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </label>
            )}
            {session ? (
              <button type="submit" disabled={create.isPending} className="btn btn-primary btn-lg ml-auto"><FilePlus2 className="size-4" aria-hidden="true" />{create.isPending ? 'Generating…' : 'Generate report'}</button>
            ) : <p className="ml-auto text-xs text-muted">Sign in (any role) to generate reports. Existing reports can be viewed without signing in.</p>}
          </div>
          {create.isError && <p role="alert" className="text-sm text-crit">{(create.error as Error).message}</p>}
        </form>
      </Panel>

      <Panel title={<>Generated reports {reports.data && <span className="num font-normal text-subtle">{reports.data.length}</span>}</>} icon={<Files className="size-4" />} className="overflow-x-auto">
        {reports.isPending ? <Loading /> : reports.isError ? <ErrorState error={reports.error} onRetry={() => reports.refetch()} /> : reports.data.length === 0 ? <EmptyState>No reports generated yet.</EmptyState> : (
          <table className="data-table">
            <thead><tr><th>Report</th><th>Generated</th><th>By</th><th><span className="sr-only">Download</span></th></tr></thead>
            <tbody>
              {reports.data.map((r) => {
                const Icon = ICON[r.type] ?? Files
                return (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/reports/${r.id}`} className="group flex items-center gap-2.5">
                        <Icon className="size-4 shrink-0 text-subtle group-hover:text-accent" aria-hidden="true" />
                        <span className="font-medium text-fg group-hover:text-accent">{r.title}</span>
                        {r.status === 'Draft' && <span className="chip text-warn">Draft</span>}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-muted" title={formatUtc(r.generatedUtc)}>{ago(r.generatedUtc)}</td>
                    <td className="text-muted">{r.generatedBy}</td>
                    <td className="text-right"><a href={`/api/reports/${r.id}/pdf`} download className="btn btn-ghost btn-sm"><Download className="size-3.5" aria-hidden="true" />PDF</a></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </Page>
  )
}
