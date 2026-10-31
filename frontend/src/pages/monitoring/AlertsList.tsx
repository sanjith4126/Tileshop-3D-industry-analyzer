import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { apiSend } from '../../api/client'
import { useAlerts } from '../../api/hooks'
import type { Alert } from '../../api/types'
import { useAuth } from '../../auth/auth'
import { EmptyState, ErrorState, Loading } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { formatUtc } from '../../lib/status'

function AlertRow({ alert }: { alert: Alert }) {
  const { hasRole } = useAuth()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const act = useMutation({
    mutationFn: (action: 'acknowledge' | 'resolve') => apiSend<Alert>('POST', `/api/alerts/${alert.id}/${action}`, { comment: comment || null }),
    onSuccess: () => {
      setComment('')
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['machines'] })
    },
  })
  const canAck = alert.status === 'Open' && hasRole('Inspector', 'MaintenanceEngineer', 'Admin')
  const canResolve = alert.status !== 'Resolved' && hasRole('MaintenanceEngineer', 'Admin')

  return (
    <li className="border-b border-line/70 px-4 py-3 last:border-0">
      <div className="flex items-center gap-2 text-sm">
        <StatusBadge status={alert.severity} />
        <span className="font-semibold text-fg">{alert.measurement}</span>
        <span className="chip ml-auto">{alert.status}</span>
      </div>
      <p className="mt-1.5 font-mono text-xs text-fg">{alert.observedValue} {alert.unit} (limit {alert.threshold})</p>
      <p className="mt-0.5 text-xs text-muted">
        <Link to={`/monitoring/${alert.machineId}`} className="font-mono hover:text-accent">{alert.machineId}</Link> · detected {formatUtc(alert.detectedUtc)} · rule-based threshold alert
      </p>
      {alert.history.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-l border-line pl-2 text-xs text-muted">
          {alert.history.map((h) => (
            <li key={h.timestampUtc}>→ {h.newStatus} by {h.userName} at {formatUtc(h.timestampUtc)}{h.comment ? ` — “${h.comment}”` : ''}</li>
          ))}
        </ul>
      )}
      {(canAck || canResolve) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`c-${alert.id}`}>Comment</label>
          <input id={`c-${alert.id}`} value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)"
            className="input input-sm min-w-0 flex-1" />
          {canAck && <button disabled={act.isPending} onClick={() => act.mutate('acknowledge')} className="btn btn-warn btn-sm">Acknowledge</button>}
          {canResolve && <button disabled={act.isPending} onClick={() => act.mutate('resolve')} className="btn btn-ok btn-sm">Resolve</button>}
        </div>
      )}
      {act.isError && <p role="alert" className="mt-1 text-xs text-crit">{(act.error as Error).message}</p>}
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
      {!session && q.data.length > 0 && <p className="border-t border-line bg-sunken/60 px-4 py-2 text-xs text-subtle">Sign in as Inspector, Maintenance Engineer or Admin to acknowledge.</p>}
    </>
  )
}
