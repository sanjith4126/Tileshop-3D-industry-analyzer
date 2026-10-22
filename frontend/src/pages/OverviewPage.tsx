import { Link, useNavigate } from 'react-router'
import { useHealth, useMachines } from '../api/hooks'
import type { MachineStatus } from '../api/types'
import { DemoBadge, EmptyState, ErrorState, Loading, Panel } from '../components/States'
import { StatusBadge } from '../components/StatusBadge'
import { STATUS_META, STATUS_ORDER, formatUtc } from '../lib/status'
import { focusEntity } from '../store/focus'

function ConfigRow({ label, ok, okText, offText }: { label: string; ok: boolean | null; okText: string; offText: string }) {
  const tone = ok == null ? 'text-slate-400' : ok ? 'text-green-300' : 'text-amber-300'
  return (
    <li className="flex justify-between gap-4 border-t border-slate-800/70 px-3 py-1.5 text-xs first:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${tone}`}>{ok == null ? '…' : ok ? okText : offText}</span>
    </li>
  )
}

export default function OverviewPage() {
  const machines = useMachines()
  const health = useHealth()
  const navigate = useNavigate()

  const showIn3D = (id: string) => {
    focusEntity(id)
    navigate('/twin')
  }

  const counts = STATUS_ORDER.map((s) => [s, machines.data?.filter((m) => m.status === s).length ?? 0] as [MachineStatus, number])
  const attention = (machines.data ?? [])
    .filter((m) => m.status !== 'Normal')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
  const f = health.data?.features

  return (
    <div className="space-y-4 p-5">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Overview</h1>
        <DemoBadge />
        {health.data?.demoData && <span className="text-xs text-slate-500">Seeded {formatUtc(health.data.demoData.seededUtc)}</span>}
      </header>

      {machines.isError ? <ErrorState error={machines.error} onRetry={() => machines.refetch()} /> : (
        <section aria-label="Machines by status" className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {counts.map(([s, n]) => (
            <Link key={s} to={`/monitoring?status=${s}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 hover:border-slate-600">
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <span aria-hidden="true" style={{ color: STATUS_META[s].color }}>{STATUS_META[s].icon}</span>{STATUS_META[s].label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums" style={{ color: n ? STATUS_META[s].color : undefined }}>
                {machines.isPending ? '–' : n}
              </p>
            </Link>
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Machines needing attention" className="lg:col-span-2"
          actions={<Link to="/twin" className="text-xs text-cyan-300 hover:underline">Open 3D twin →</Link>}>
          {machines.isPending ? <Loading /> : attention.length === 0 ? <EmptyState>All machines report Normal.</EmptyState> : (
            <ul>
              {attention.map((m) => (
                <li key={m.id} className="flex items-center gap-3 border-t border-slate-800/70 px-3 py-2 first:border-0">
                  <StatusBadge status={m.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-mono text-xs text-slate-400">{m.id}</span> · {m.name}</p>
                    <p className="truncate text-xs text-slate-400">{m.statusReasons.join('; ')}</p>
                  </div>
                  <button onClick={() => showIn3D(m.id)} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Show in 3D</button>
                  <Link to={`/monitoring/${m.id}`} className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">Details</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Configuration status">
          {health.isError ? <ErrorState error={health.error} onRetry={() => health.refetch()} /> : (
            <ul>
              <ConfigRow label="Backend API" ok={health.isPending ? null : true} okText="Online" offText="Offline" />
              <ConfigRow label="Database" ok={f ? health.data!.database === 'ok' : null} okText="Connected" offText="Unavailable" />
              <ConfigRow label="AI assistant" ok={f ? f.ai : null} okText="Configured" offText="AI NOT CONFIGURED" />
              <ConfigRow label="Knowledge search" ok={f ? f.embeddings : null} okText="Embeddings" offText="Keyword only" />
              <ConfigRow label="Dev users" ok={f ? f.devUsers : null} okText="DEV ONLY users on" offText="None" />
            </ul>
          )}
          <p className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
            ML service and tile model status appear here once those modules are built.
          </p>
        </Panel>
      </div>
    </div>
  )
}
