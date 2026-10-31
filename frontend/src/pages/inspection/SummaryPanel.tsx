import { useMutation } from '@tanstack/react-query'
import { Box, FileText } from 'lucide-react'
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
    <div className="space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => gen.mutate()} disabled={gen.isPending} className="btn btn-primary">
          <FileText className="size-4" aria-hidden="true" />
          {gen.isPending ? 'Generating…' : `Generate inspection summary — ${zoneName}`}
        </button>
        {!s && <span className="text-xs text-subtle">Deterministic summary computed from inspection records.</span>}
      </div>
      {gen.isError && <ErrorState error={gen.error} />}
      {s && (
        <article aria-label="Inspection summary" className="space-y-1.5 rounded-lg border border-line bg-sunken p-4">
          <header className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{s.scope} · generated {formatUtc(s.generatedUtc)}</span>
            {s.dataClassification === 'SYNTHETIC' && <DemoBadge />}
          </header>
          {s.lines.map((l, i) => <p key={i} className={i === s.lines.length - 1 ? 'text-xs text-subtle' : 'text-fg'}>{l}</p>)}
          {s.focusEntityIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {s.focusEntityIds.map((id) => (
                <button key={id} onClick={() => { focusEntity(id); navigate('/twin') }} className="btn btn-secondary btn-sm">
                  <Box className="size-3.5" aria-hidden="true" />Show {id} in 3D
                </button>
              ))}
            </div>
          )}
          <p className="pt-1 text-[10px] text-subtle">Computed from records by fixed rules (no AI). AI wording can be added when the assistant is configured.</p>
        </article>
      )}
    </div>
  )
}
