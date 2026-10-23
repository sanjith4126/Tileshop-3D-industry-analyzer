import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { apiSend } from '../../api/client'
import { useObservation } from '../../api/hooks'
import type { ObservationDetail, ObservationSummary } from '../../api/types'
import { useAuth } from '../../auth/auth'
import { DemoBadge, ErrorState, Loading, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { PriorityBadge } from './InspectionPage'

const ROLES = ['', 'Inspector', 'MaintenanceEngineer', 'Admin', 'Viewer']

function UpdateForm({ o }: { o: ObservationSummary }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [status, setStatus] = useState(o.status)
  const [role, setRole] = useState(o.assignedRole ?? '')
  const [user, setUser] = useState(o.assignedUser ?? '')
  const [comment, setComment] = useState('')
  const save = useMutation({
    mutationFn: () => apiSend<ObservationDetail>('PATCH', `/api/observations/${o.id}`,
      { status, assignedRole: role, assignedUser: user, comment: comment || null }, session?.token ?? null),
    onSuccess: (d) => {
      setComment('')
      qc.setQueryData(['observation', o.id], d)
      qc.invalidateQueries({ queryKey: ['observations'] })
      qc.invalidateQueries({ queryKey: ['inspection-zones'] })
    },
  })
  const field = 'mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm'

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="grid gap-2 p-3 text-xs sm:grid-cols-2">
      <label>Status
        <select value={status} onChange={(e) => setStatus(e.target.value as ObservationSummary['status'])} className={field}>
          {['Open', 'InProgress', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label>Assigned role
        <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
          {ROLES.map((r) => <option key={r} value={r}>{r || '— none —'}</option>)}
        </select>
      </label>
      <label className="sm:col-span-2">Assigned user (email)
        <input value={user} maxLength={256} onChange={(e) => setUser(e.target.value)} className={field} />
      </label>
      <label className="sm:col-span-2">Comment
        <textarea value={comment} maxLength={1000} rows={2} onChange={(e) => setComment(e.target.value)} className={field} />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={save.isPending} className="rounded bg-cyan-700 px-3 py-1.5 font-semibold hover:bg-cyan-600 disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save update'}
        </button>
        {save.isSuccess && <span className="text-green-300">Saved.</span>}
        {save.isError && <span role="alert" className="text-red-300">{(save.error as Error).message}</span>}
      </div>
    </form>
  )
}

export default function ObservationDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const q = useObservation(id)

  if (q.isPending) return <Loading label="Loading observation…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const { observation: o, correctiveActions, attachments, history } = q.data
  const showIn3D = (entityId: string) => { focusEntity(entityId); navigate('/twin') }

  return (
    <div className="space-y-4 p-5">
      <nav className="text-xs text-slate-400"><Link to="/inspection" className="hover:underline">Remote Site Inspection</Link> / {o.code}</nav>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{o.code}</h1>
        <PriorityBadge priority={o.priority} />
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs">{o.status}</span>
        {o.dataOrigin === 'Synthetic' && <DemoBadge />}
        <div className="ml-auto flex gap-2">
          <button onClick={() => showIn3D(o.zoneId)} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Show zone in 3D</button>
          {o.machineId && <button onClick={() => showIn3D(o.machineId!)} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">Show {o.machineId} in 3D</button>}
        </div>
      </header>
      <p className="max-w-3xl text-base">{o.description}</p>
      <p className="text-xs text-slate-400">
        {o.category} · {o.zoneName}{o.machineId && <> · <Link to={`/monitoring/${o.machineId}`} className="text-cyan-300 hover:underline">{o.machineId}</Link></>}
        {' '}· raised {formatUtc(o.createdUtc)} during “{q.data.inspectionTitle}” by {q.data.inspectorName ?? 'unknown'}
        {' '}· assigned to {o.assignedUser ?? o.assignedRole ?? 'nobody'}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Corrective actions">
          {correctiveActions.length === 0 ? <p className="p-3 text-sm text-slate-500">No corrective actions.</p> : (
            <ul>
              {correctiveActions.map((a) => (
                <li key={a.id} className="border-t border-slate-800/70 px-3 py-2 text-sm first:border-0">
                  <p>{a.description}</p>
                  <p className="text-xs text-slate-400">
                    {a.status} · {a.assignedRole ?? 'unassigned'} · due {formatUtc(a.dueUtc)}
                    {a.completedUtc && ` · done ${formatUtc(a.completedUtc)}`}
                    {a.overdue && <span className="ml-1 font-semibold text-red-300">⚠ overdue</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="History">
          <ol className="space-y-1.5 p-3 text-xs">
            {history.map((h, i) => (
              <li key={i}><span className="text-slate-500">{formatUtc(h.timestampUtc)}</span> · <span className="font-semibold">{h.action}</span>{h.details && ` — ${h.details}`} <span className="text-slate-500">({h.userName})</span></li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Attachments">
        {attachments.length === 0 ? <p className="p-3 text-sm text-slate-500">No attachments.</p> : (
          <div className="flex flex-wrap gap-3 p-3">
            {attachments.map((a) => (
              <figure key={a.id} className="w-80">
                <img src={a.url} alt={`${a.caption}${a.isPlaceholder ? ' (synthetic placeholder image, not a real photograph)' : ''}`} className="w-full rounded border border-slate-700" />
                <figcaption className="mt-1 text-xs text-slate-400">{a.caption}{a.isPlaceholder && <span className="ml-1 font-semibold text-amber-300">· SYNTHETIC PLACEHOLDER</span>}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Update status / assignment">
        {hasRole('Inspector', 'Admin') ? <UpdateForm key={o.updatedUtc} o={o} />
          : <p className="p-3 text-sm text-slate-500">Sign in as Inspector or Admin to update status or assignment.</p>}
      </Panel>
    </div>
  )
}
