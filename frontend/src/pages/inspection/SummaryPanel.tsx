import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { apiSend } from '../../api/client'
import type { InspectionSummary } from '../../api/types'
import { useAuth } from '../../auth/auth'
import { DemoBadge, ErrorState } from '../../components/States'
import { formatUtc } from '../../lib/status'
import { focusEntity } from '../../store/focus'

/** "Generate inspection summary": deterministic text computed by the backend from records. */
export function SummaryPanel({ zoneId, zoneName }: { zoneId: string | null; zoneName: string }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const gen = useMutation({
    mutationFn: () => apiSend<InspectionSummary>('POST', '/api/inspection/summary', { zoneId }, session?.token ?? null),
  })
  const s = gen.data

  return (
    <div className="space-y-2 p-3 text-sm">
      <button onClick={() => gen.mutate()} disabled={gen.isPending} className="rounded bg-cyan-700 px-3 py-1.5 text-xs font-semibold hover:bg-cyan-600 disabled:opacity-50">
        {gen.isPending ? 'Generating…' : `Generate inspection summary — ${zoneName}`}
      </button>
      {gen.isError && <ErrorState error={gen.error} />}
      {s && (
        <article aria-label="Inspection summary" className="space-y-1.5 rounded border border-slate-800 bg-slate-950 p-3">
          <header className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{s.scope} · generated {formatUtc(s.generatedUtc)}</span>
            {s.containsSyntheticData && <DemoBadge />}
          </header>
          {s.lines.map((l, i) => <p key={i} className={i === s.lines.length - 1 ? 'text-xs text-slate-500' : ''}>{l}</p>)}
          {s.focusEntityIds.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {s.focusEntityIds.map((id) => (
                <button key={id} onClick={() => { focusEntity(id); navigate('/twin') }} className="rounded bg-slate-800 px-2 py-0.5 text-xs hover:bg-slate-700">
                  Show {id} in 3D
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-500">Computed from records by fixed rules (no AI). AI wording can be added when the assistant is configured.</p>
        </article>
      )}
    </div>
  )
}
