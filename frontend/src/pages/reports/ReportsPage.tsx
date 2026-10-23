import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { apiSend } from '../../api/client'
import { useMachines, useReports, useZones } from '../../api/hooks'
import type { Report, ReportType } from '../../api/types'
import { useAuth } from '../../auth/auth'
import { DemoBadge, EmptyState, ErrorState, Loading, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'

export const REPORT_TYPES: { type: ReportType; label: string; filter: 'machine' | 'zone' | null }[] = [
  { type: 'FactoryHealth', label: 'Factory health', filter: null },
  { type: 'MachineAnomalies', label: 'Machine anomalies', filter: 'machine' },
  { type: 'MaintenanceHistory', label: 'Maintenance history', filter: 'machine' },
  { type: 'SiteInspection', label: 'Site inspection', filter: 'zone' },
]
const PERIODS = [{ label: 'Last 24 h', days: 1 }, { label: 'Last 7 days', days: 7 }, { label: 'Last 30 days', days: 30 }, { label: 'Last 90 days', days: 90 }]

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
      }, session?.token ?? null)
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      navigate(`/reports/${r.id}`)
    },
  })
  const field = 'mt-0.5 block w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm'

  return (
    <div className="space-y-4 p-5">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Reports</h1>
        <DemoBadge />
      </header>
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Panel title="Generate report">
          <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-3 p-3 text-xs">
            <label className="block">Report type
              <select value={type} onChange={(e) => setType(e.target.value as ReportType)} className={field}>
                {REPORT_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">Period
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={field}>
                {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
              </select>
            </label>
            {filter === 'machine' && (
              <label className="block">Machine (optional)
                <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className={field}>
                  <option value="">All machines</option>
                  {machines.data?.map((m) => <option key={m.id} value={m.id}>{m.id} — {m.name}</option>)}
                </select>
              </label>
            )}
            {filter === 'zone' && (
              <label className="block">Zone (optional)
                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={field}>
                  <option value="">All zones</option>
                  {zones.data?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </label>
            )}
            {session ? (
              <button type="submit" disabled={create.isPending} className="rounded bg-cyan-700 px-3 py-1.5 font-semibold hover:bg-cyan-600 disabled:opacity-50">
                {create.isPending ? 'Generating…' : 'Generate report'}
              </button>
            ) : <p className="text-slate-400">Sign in (any role) to generate reports. Existing reports can be viewed without signing in.</p>}
            {create.isError && <p role="alert" className="text-red-300">{(create.error as Error).message}</p>}
            <p className="text-[11px] text-slate-500">Built only from database records. Viewable in the browser and as PDF. Empty periods give a valid "no records" report.</p>
          </form>
        </Panel>

        <Panel title="Generated reports">
          {reports.isPending ? <Loading /> : reports.isError ? <ErrorState error={reports.error} onRetry={() => reports.refetch()} /> : reports.data.length === 0 ? <EmptyState>No reports generated yet.</EmptyState> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2 font-normal">Report</th><th className="font-normal">Generated</th><th className="font-normal">By</th><th /></tr></thead>
              <tbody>
                {reports.data.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800/70">
                    <td className="px-3 py-2"><Link to={`/reports/${r.id}`} className="text-cyan-300 hover:underline">{r.title}</Link>{r.status === 'Draft' && <span className="ml-2 text-xs text-amber-300">Draft</span>}</td>
                    <td className="text-xs text-slate-400">{formatUtc(r.generatedUtc)}</td>
                    <td className="text-xs text-slate-400">{r.generatedBy}</td>
                    <td className="pr-3 text-right"><a href={`/api/reports/${r.id}/pdf`} download className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">PDF</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  )
}
