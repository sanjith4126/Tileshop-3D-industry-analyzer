import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, apiGet } from '../../api/client'
import { useAuth } from '../../auth/auth'
import { EmptyState, ErrorState, Loading, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'

interface TileStatus { mlAvailable: boolean; configured: boolean; status: string; labels: string[] | null; modelCard: Record<string, unknown> | null }
interface TileResult {
  id: string; originalFileName: string; sizeBytes: number; uploadedBy: string | null; uploadedUtc: string
  outcome: 'Classified' | 'ModelNotConfigured' | 'MlUnavailable' | 'Failed'; label: string | null; confidence: number | null
  probabilities: Record<string, number> | null; modelName: string | null; modelVersion: string | null; message: string | null; imageUrl: string
}
interface Sample { id: string; image: string; title: string; documentedResult: { label: string; note: string } }

const MAX_BYTES = 10 * 1024 * 1024

function Outcome({ r }: { r: TileResult }) {
  if (r.outcome === 'Classified')
    return (
      <div className="space-y-1">
        <p className="text-lg font-semibold">{r.label} <span className="text-sm font-normal text-slate-400">{((r.confidence ?? 0) * 100).toFixed(1)} % confidence</span></p>
        <ul className="text-xs text-slate-400">{Object.entries(r.probabilities ?? {}).map(([k, v]) => <li key={k}>{k}: {(v * 100).toFixed(1)} %</li>)}</ul>
        <p className="text-[11px] text-slate-500">Model {r.modelName} {r.modelVersion} — a model prediction, to be confirmed by an inspector.</p>
      </div>
    )
  return (
    <p role="alert" className="font-bold text-amber-300">
      {r.outcome === 'ModelNotConfigured' ? 'MODEL NOT CONFIGURED' : r.outcome === 'MlUnavailable' ? 'ML SERVICE UNAVAILABLE' : 'CLASSIFICATION FAILED'}
      <span className="block text-xs font-normal text-slate-400">{r.message} The image was stored; no result was produced.</span>
    </p>
  )
}

export default function TileQualityPage() {
  const { session, hasRole } = useAuth()
  const qc = useQueryClient()
  const status = useQuery({ queryKey: ['tile-status'], queryFn: ({ signal }) => apiGet<TileStatus>('/api/tile-inspections/status', signal) })
  const history = useQuery({ queryKey: ['tile-history'], queryFn: ({ signal }) => apiGet<TileResult[]>('/api/tile-inspections', signal) })
  const samples = useQuery({ queryKey: ['tile-samples'], queryFn: ({ signal }) => apiGet<Sample[]>('/tile-samples/samples.json', signal), staleTime: Infinity })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [sampleMode, setSampleMode] = useState(false)

  // Revoke the last preview URL when leaving the page.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const upload = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData()
      form.append('file', f)
      const res = await fetch('/api/tile-inspections', { method: 'POST', body: form, headers: { Authorization: `Bearer ${session?.token}` } })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { errors?: Record<string, string[]> } | null
        throw new ApiError(res.status, res.status === 403 ? 'Your role cannot upload' : body?.errors?.file?.[0] ?? `Upload failed (${res.status})`)
      }
      return (await res.json()) as TileResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tile-history'] }),
  })

  const pick = (f: File | null) => {
    setLocalError(null)
    upload.reset()
    if (f && !['image/jpeg', 'image/png'].includes(f.type)) return setLocalError('Choose a JPEG or PNG image.')
    if (f && f.size > MAX_BYTES) return setLocalError('Image is larger than 10 MB.')
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  const s = status.data
  return (
    <div className="space-y-4 p-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Tile Quality Inspection</h1>
        {status.isPending ? <Loading /> : s && (
          <span className={`rounded px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${s.configured ? 'bg-green-500/15 text-green-300 ring-green-500/40' : 'bg-amber-500/15 text-amber-300 ring-amber-500/40'}`}>
            {s.configured ? `Model ready: ${String(s.modelCard?.name ?? '')} ${String(s.modelCard?.version ?? '')}` : !s.mlAvailable ? 'ML SERVICE UNAVAILABLE' : 'MODEL NOT CONFIGURED'}
          </span>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs">
          <input type="checkbox" checked={sampleMode} onChange={(e) => setSampleMode(e.target.checked)} className="accent-amber-500" /> Sample demo mode
        </label>
      </header>
      {s && !s.configured && s.mlAvailable && <p className="text-xs text-slate-400">{s.status}. See docs/TILE-MODEL.md to add a trained ONNX model (set TILE_MODEL_PATH). Uploads are stored but not classified.</p>}

      {sampleMode ? (
        <Panel title="Sample demo mode — documented results for bundled synthetic images">
          <p className="border-b border-slate-800 px-3 py-2 text-sm font-bold text-amber-300">SAMPLE RESULT — not a model prediction</p>
          {samples.isPending ? <Loading /> : samples.isError ? <ErrorState error={samples.error} /> : (
            <div className="grid gap-3 p-3 md:grid-cols-3">
              {samples.data.map((x) => (
                <figure key={x.id} className="rounded border border-slate-800 p-2">
                  <img src={x.image} alt={`${x.title} (synthetic sample image)`} className="w-full rounded" />
                  <figcaption className="mt-2 text-sm"><b>{x.title}</b> — documented label <span className="font-mono text-amber-200">{x.documentedResult.label}</span>
                    <span className="block text-xs text-slate-400">{x.documentedResult.note} SAMPLE RESULT — not a model prediction.</span></figcaption>
                </figure>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Upload tile image">
            <div className="space-y-3 p-3 text-sm">
              {!hasRole('Inspector', 'MaintenanceEngineer', 'Admin') ? <p className="text-slate-400">Sign in as Inspector, Maintenance Engineer or Admin to upload.</p> : (
                <form onSubmit={(e) => { e.preventDefault(); if (file) upload.mutate(file) }} className="space-y-2">
                  <input type="file" accept="image/jpeg,image/png" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-label="Tile image (JPEG or PNG, max 10 MB)"
                    className="block text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-100" />
                  {localError && <p role="alert" className="text-red-300">{localError}</p>}
                  {preview && <img src={preview} alt="Preview of selected tile image" className="max-h-64 rounded border border-slate-700" />}
                  <button type="submit" disabled={!file || upload.isPending} className="rounded bg-cyan-700 px-3 py-1.5 text-xs font-semibold hover:bg-cyan-600 disabled:opacity-50">
                    {upload.isPending ? 'Uploading…' : 'Submit for inspection'}
                  </button>
                  <p className="text-[11px] text-slate-500">JPEG or PNG, max 10 MB. The server checks the file content, not just the extension.</p>
                </form>
              )}
              {upload.isError && <p role="alert" className="text-red-300">{(upload.error as Error).message}</p>}
              {upload.data && <div className="rounded border border-slate-800 p-3"><Outcome r={upload.data} /></div>}
            </div>
          </Panel>
          <Panel title="History">
            {history.isPending ? <Loading /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : history.data.length === 0 ? <EmptyState>No tile images inspected yet.</EmptyState> : (
              <ul>
                {history.data.map((r) => (
                  <li key={r.id} className="flex gap-3 border-t border-slate-800/70 p-2 first:border-0">
                    <img src={r.imageUrl} alt={r.originalFileName} className="h-14 w-14 rounded object-cover" />
                    <div className="min-w-0 text-xs">
                      <p className="truncate text-sm">{r.originalFileName}</p>
                      <p className="text-slate-400">{formatUtc(r.uploadedUtc)} · {r.uploadedBy}</p>
                      <p>{r.outcome === 'Classified' ? `${r.label} (${((r.confidence ?? 0) * 100).toFixed(0)} %)` : <span className="text-amber-300">{r.outcome === 'ModelNotConfigured' ? 'MODEL NOT CONFIGURED' : r.outcome === 'MlUnavailable' ? 'ML service unavailable' : 'Failed'}</span>}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
