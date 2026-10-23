import { useMutation } from '@tanstack/react-query'
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

  return (
    <Panel title="Maintenance prioritisation workflow" actions={session && (
      <div className="flex gap-1">
        <button onClick={() => run.mutate(false)} disabled={run.isPending} className="rounded bg-cyan-700 px-2 py-0.5 text-xs font-semibold hover:bg-cyan-600 disabled:opacity-50">{run.isPending ? 'Running…' : 'Run'}</button>
        <button onClick={() => run.mutate(true)} disabled={run.isPending} className="rounded bg-slate-800 px-2 py-0.5 text-xs hover:bg-slate-700 disabled:opacity-50">Run + PDF report</button>
      </div>
    )}>
      {!session && <p className="p-3 text-xs text-slate-400">Sign in (any role) to run the workflow.</p>}
      {run.isError && <ErrorState error={run.error} />}
      {run.data?.status === 'Failed' && <p role="alert" className="p-3 text-sm text-red-300">Workflow failed: {run.data.error}</p>}
      {out && (
        <div className="space-y-2 p-3 text-sm">
          <p>{out.aiWording ?? out.recommendation}</p>
          {out.aiWording && <p className="text-[11px] text-slate-500">Reworded by AI from the deterministic recommendation: “{out.recommendation}”</p>}
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500"><tr><th className="py-1 font-normal">#</th><th className="font-normal">Machine</th><th className="font-normal">Status</th><th className="font-normal">Score</th><th className="font-normal">Band / factors</th><th /></tr></thead>
            <tbody>
              {out.ranking.filter((r) => r.score > 0).map((r) => (
                <tr key={r.machineId} className="border-t border-slate-800/70 align-top">
                  <td className="py-1.5">{r.rank}</td>
                  <td><span className="font-mono">{r.machineId}</span><br /><span className="text-slate-400">{r.name}</span></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-base font-semibold tabular-nums">{r.score}</td>
                  <td><p className="font-semibold">{r.band}</p><ul className="text-slate-400">{r.factors.map((f) => <li key={f.factor}>+{f.points} {f.factor}</li>)}</ul></td>
                  <td><button onClick={() => { focusEntity(r.machineId); navigate('/twin') }} className="rounded bg-slate-800 px-2 py-0.5 hover:bg-slate-700">3D</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500">{out.ranking.filter((r) => r.score === 0).length} machine(s) score 0 (routine). Excluded: {out.excluded.join(', ') || 'none'}.</p>
          {out.reportId && <a href={`/api/reports/${out.reportId}/pdf`} download className="inline-block rounded bg-cyan-700 px-3 py-1 text-xs font-semibold hover:bg-cyan-600">Download PDF report</a>}
          <p className="text-xs text-amber-200">{out.reviewLabel}</p>
        </div>
      )}
    </Panel>
  )
}
