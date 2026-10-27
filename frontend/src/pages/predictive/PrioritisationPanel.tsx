import { useMutation } from '@tanstack/react-query'
import { Box, Download, FileText, ListOrdered, Play } from 'lucide-react'
import { useNavigate } from 'react-router'
import { apiSend } from '../../api/client'
import type { MachineStatus } from '../../api/types'
import { useAuth } from '../../auth/auth'
import { ErrorState, Panel } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { focusEntity } from '../../store/focus'

interface Output {
  ranking: { rank: number; machineId: string; name: string; zoneName: string; status: MachineStatus; score: number; band: string; factors: { factor: string; points: number }[]; suggestedActions: { ruleId: string; action: string }[] }[]
  excluded: string[]
  recommendation: string
  aiWording: string | null
  focusEntityIds: string[]
  reportId: string | null
  reviewLabel: string
}
interface Execution { id: string; status: 'Running' | 'Succeeded' | 'Failed'; error: string | null; output: Output | null }

/** Maintenance-prioritisation workflow: deterministic scoring, explainable factors, optional PDF report. */
export function PrioritisationPanel() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const run = useMutation({
    mutationFn: (createReport: boolean) => apiSend<Execution>('POST', '/api/workflows/maintenance-prioritisation',
      { zoneId: null, createReport, aiWording: true }, session?.token ?? null),
  })
  const out = run.data?.output
  const ranked = out?.ranking.filter((r) => r.score > 0) ?? []
  const top = Math.max(1, ...ranked.map((r) => r.score))

  return (
    <Panel title="Maintenance prioritisation workflow" icon={<ListOrdered className="size-4" />} actions={session && (
      <>
        <button onClick={() => run.mutate(false)} disabled={run.isPending} className="btn btn-primary btn-sm"><Play className="size-3.5" aria-hidden="true" />{run.isPending ? 'Running…' : 'Run'}</button>
        <button onClick={() => run.mutate(true)} disabled={run.isPending} className="btn btn-secondary btn-sm"><FileText className="size-3.5" aria-hidden="true" />Run + PDF report</button>
      </>
    )}>
      {!out && !run.isError && (
        <p className="px-4 py-3 text-sm text-muted">
          Ranks machines by a documented scoring rule (alerts + readings + anomaly score + maintenance history) and explains every point.
          {!session && <span className="text-subtle"> Sign in (any role) to run the workflow.</span>}
        </p>
      )}
      {run.isError && <ErrorState error={run.error} />}
      {run.data?.status === 'Failed' && <p role="alert" className="p-4 text-sm text-crit">Workflow failed: {run.data.error}</p>}
      {out && (
        <div className="space-y-3 p-4 text-sm">
          <p className="text-fg">{out.aiWording ?? out.recommendation}</p>
          {out.aiWording && <p className="text-[11px] text-subtle">Reworded by AI from the deterministic recommendation: “{out.recommendation}”</p>}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="data-table">
              <thead><tr><th>#</th><th>Machine</th><th>Status</th><th>Score</th><th>Band · factors</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.machineId} className="align-top">
                    <td className="num text-muted">{r.rank}</td>
                    <td><span className="font-mono text-xs text-fg">{r.machineId}</span><span className="block text-xs text-muted">{r.name} · {r.zoneName}</span></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="w-36">
                      <span className="num text-base font-semibold text-fg">{r.score}</span>
                      <div className="mt-1 h-1.5 rounded-full bg-line" aria-hidden="true"><div className="h-full rounded-full bg-accent" style={{ width: `${(r.score / top) * 100}%` }} /></div>
                    </td>
                    <td className="text-xs"><p className="font-semibold text-fg">{r.band}</p><ul className="text-muted">{r.factors.map((f) => <li key={f.factor}><span className="num">+{f.points}</span> {f.factor}</li>)}</ul></td>
                    <td><button onClick={() => { focusEntity(r.machineId); navigate('/twin') }} className="btn btn-ghost btn-sm" aria-label={`Show ${r.machineId} in 3D`}><Box className="size-3.5" aria-hidden="true" />3D</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-subtle">{out.ranking.filter((r) => r.score === 0).length} machine(s) score 0 (routine). Excluded: {out.excluded.join(', ') || 'none'}.</p>
          <div className="flex flex-wrap items-center gap-3">
            {out.reportId && <a href={`/api/reports/${out.reportId}/pdf`} download className="btn btn-primary btn-sm"><Download className="size-3.5" aria-hidden="true" />Download PDF report</a>}
            <p className="text-xs font-medium text-warn">{out.reviewLabel}</p>
          </div>
        </div>
      )}
    </Panel>
  )
}
