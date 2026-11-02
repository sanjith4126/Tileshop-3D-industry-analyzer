import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, History, ImageIcon, ListChecks, PencilLine, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { apiSend } from '../../api/client'
import { useObservation } from '../../api/hooks'
import type { ObservationDetail, ObservationSummary } from '../../api/types'
import { useAuth } from '../../auth/auth'
import { AuthImage } from '../../components/AuthMedia'
import { DemoBadge, EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { PriorityBadge } from './InspectionPage'

const ROLES = ['', 'Inspector', 'MaintenanceEngineer', 'PlantManager', 'Administrator']

function UpdateForm({ o }: { o: ObservationSummary }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(o.status)
  const [role, setRole] = useState(o.assignedRole ?? '')
  const [user, setUser] = useState(o.assignedUser ?? '')
  const [comment, setComment] = useState('')
  const save = useMutation({
    mutationFn: () => apiSend<ObservationDetail>('PATCH', `/api/observations/${o.id}`,
      { status, assignedRole: role, assignedUser: user, comment: comment || null }),
    onSuccess: (d) => {
      setComment('')
      qc.setQueryData(['observation', o.id], d)
      qc.invalidateQueries({ queryKey: ['observations'] })
      qc.invalidateQueries({ queryKey: ['inspection-zones'] })
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="grid gap-3 p-4 sm:grid-cols-2">
      <label><span className="field-label">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as ObservationSummary['status'])} className="input">
          {['Open', 'InProgress', 'Resolved', 'Closed'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label><span className="field-label">Assigned role</span>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
          {ROLES.map((r) => <option key={r} value={r}>{r || '— none —'}</option>)}
        </select>
      </label>
      <label className="sm:col-span-2"><span className="field-label">Assigned user (email)</span>
        <input value={user} maxLength={256} onChange={(e) => setUser(e.target.value)} className="input" />
      </label>
      <label className="sm:col-span-2"><span className="field-label">Comment</span>
        <textarea value={comment} maxLength={1000} rows={2} onChange={(e) => setComment(e.target.value)} className="input" />
      </label>
      <div className="flex items-center gap-3 text-sm sm:col-span-2">
        <button type="submit" disabled={save.isPending} className="btn btn-primary">{save.isPending ? 'Saving…' : 'Save update'}</button>
        {save.isSuccess && <span className="text-ok">Saved.</span>}
        {save.isError && <span role="alert" className="text-crit">{(save.error as Error).message}</span>}
      </div>
    </form>
  )
}

export default function ObservationDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const q = useObservation(id)

  if (q.isPending) return <Loading label="Loading observation…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const { observation: o, correctiveActions, attachments, history } = q.data
  const showIn3D = (entityId: string) => { focusEntity(entityId); navigate('/twin') }
  const facts: [string, React.ReactNode][] = [
    ['Category', o.category],
    ['Zone', o.zoneName],
    ['Machine', o.machineId ? <Link key="m" to={`/monitoring/${o.machineId}`} className="link font-mono text-xs">{o.machineId}</Link> : '—'],
    ['Raised', formatUtc(o.createdUtc)],
    ['Inspection', q.data.inspectionTitle],
    ['Inspector', q.data.inspectorName ?? 'unknown'],
    ['Assigned to', o.assignedUser ?? o.assignedRole ?? 'nobody'],
    ['Last updated', formatUtc(o.updatedUtc)],
  ]

  return (
    <Page>
      <PageHeader
        eyebrow={<><Link to="/inspection" className="link">Remote Site Inspection</Link> / <span className="font-mono normal-case">{o.code}</span></>}
        title={<span className="font-mono">{o.code}</span>}
        badges={<><PriorityBadge priority={o.priority} /><span className="chip">{o.status}</span>{o.dataClassification === 'SYNTHETIC' && <DemoBadge />}</>}
        actions={<>
          <button onClick={() => showIn3D(o.zoneId)} className="btn btn-secondary"><Box className="size-4" aria-hidden="true" />Show zone in 3D</button>
          {o.machineId && <button onClick={() => showIn3D(o.machineId!)} className="btn btn-secondary"><Box className="size-4" aria-hidden="true" />Show {o.machineId} in 3D</button>}
        </>}
      />

      <section className="card p-5">
        <p className="max-w-4xl text-base leading-relaxed text-fg">{o.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm md:grid-cols-4">
          {facts.map(([k, v]) => <div key={k}><dt className="text-xs text-subtle">{k}</dt><dd className="mt-0.5 text-fg">{v}</dd></div>)}
        </dl>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="Corrective actions" icon={<ListChecks className="size-4" />}>
          {correctiveActions.length === 0 ? <EmptyState>No corrective actions.</EmptyState> : (
            <ul>
              {correctiveActions.map((a) => (
                <li key={a.id} className="border-b border-line/70 px-4 py-3 text-sm last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-fg">{a.description}</p>
                    <span className="chip shrink-0">{a.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {a.assignedRole ?? 'unassigned'} · due {formatUtc(a.dueUtc)}
                    {a.completedUtc && ` · done ${formatUtc(a.completedUtc)}`}
                    {a.overdue && <span className="ml-2 inline-flex items-center gap-1 font-semibold text-crit"><TriangleAlert className="size-3.5" aria-hidden="true" />overdue</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="History" icon={<History className="size-4" />}>
          <ol className="relative m-4 space-y-3 border-l border-line pl-5 text-xs">
            {history.map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute top-1 -left-6.5 size-2.5 rounded-full border-2 border-surface bg-line-strong" aria-hidden="true" />
                <p className="text-subtle">{formatUtc(h.timestampUtc)} · {h.userName}</p>
                <p className="text-fg"><span className="font-semibold">{h.action}</span>{h.details && ` — ${h.details}`}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Attachments" icon={<ImageIcon className="size-4" />}>
        {attachments.length === 0 ? <EmptyState>No attachments.</EmptyState> : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {attachments.map((a) => (
              <figure key={a.id} className="overflow-hidden rounded-lg border border-line bg-sunken">
                <AuthImage src={a.url} alt={`${a.caption}${a.isPlaceholder ? ' (synthetic placeholder image, not a real photograph)' : ''}`} className="aspect-[4/3] w-full" />
                <figcaption className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted">
                  {a.caption}{a.isPlaceholder && <span className="font-semibold text-warn">SYNTHETIC PLACEHOLDER</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Update status / assignment" icon={<PencilLine className="size-4" />}>
        {can('inspections.perform', 'inspections.manage') ? <UpdateForm key={o.updatedUtc} o={o} />
          : <EmptyState icon={false}>Your role can view this observation but not update its status or assignment.</EmptyState>}
      </Panel>
    </Page>
  )
}
