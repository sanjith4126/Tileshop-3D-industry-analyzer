import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiSend } from '../../api/client'
import { useAlerts } from '../../api/hooks'
import type { Alert } from '../../api/types'
import { useAuth } from '../../auth/auth'
import { EmptyState, ErrorState, Loading } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { formatUtc } from '../../lib/status'

function AlertRow({ alert }: { alert: Alert }) {
  const { session, hasRole } = useAuth()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const act = useMutation({
    mutationFn: (action: 'acknowledge' | 'resolve') => apiSend<Alert>('POST', `/api/alerts/${alert.id}/${action}`, { comment: comment || null }, session?.token ?? null),
    onSuccess: () => {
      setComment('')
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['machines'] })
    },
  })
  const canAck = alert.status === 'Open' && hasRole('Inspector', 'MaintenanceEngineer', 'Admin')
  const canResolve = alert.status !== 'Resolved' && hasRole('MaintenanceEngineer', 'Admin')

  return (
    <li className="border-t border-slate-800/70 px-3 py-2 first:border-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={alert.severity} />
        <span className="font-semibold">{alert.measurement}</span>
        <span className="font-mono text-xs text-slate-300">{alert.observedValue} {alert.unit} (limit {alert.threshold})</span>
        <span className="ml-auto rounded bg-slate-800 px-1.5 text-xs">{alert.status}</span>
      </div>
      <p className="text-xs text-slate-400">{alert.machineId} · detected {formatUtc(alert.detectedUtc)} · rule-based threshold alert</p>
      {alert.history.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
          {alert.history.map((h) => (
            <li key={h.timestampUtc}>→ {h.newStatus} by {h.userName} at {formatUtc(h.timestampUtc)}{h.comment ? ` — “${h.comment}”` : ''}</li>
          ))}
        </ul>
      )}
      {(canAck || canResolve) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`c-${alert.id}`}>Comment</label>
          <input id={`c-${alert.id}`} value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)"
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs" />
          {canAck && <button disabled={act.isPending} onClick={() => act.mutate('acknowledge')} className="rounded bg-amber-700 px-2 py-0.5 text-xs hover:bg-amber-600 disabled:opacity-50">Acknowledge</button>}
          {canResolve && <button disabled={act.isPending} onClick={() => act.mutate('resolve')} className="rounded bg-green-800 px-2 py-0.5 text-xs hover:bg-green-700 disabled:opacity-50">Resolve</button>}
        </div>
      )}
      {act.isError && <p role="alert" className="mt-1 text-xs text-red-300">{(act.error as Error).message}</p>}
    </li>
  )
}

export function AlertsList({ machineId }: { machineId?: string }) {
  const { session } = useAuth()
  const q = useAlerts(machineId)
  if (q.isPending) return <Loading label="Loading alerts…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  return (
    <>
      {q.data.length === 0 ? <EmptyState>No open or acknowledged alerts.</EmptyState> : (
        <ul>{q.data.map((a) => <AlertRow key={a.id} alert={a} />)}</ul>
      )}
      {!session && q.data.length > 0 && <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">Sign in as Inspector, Maintenance Engineer or Admin to acknowledge.</p>}
    </>
  )
}
