import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, FlaskConical, History, ImageUp, ScanSearch, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiGet, apiUpload } from '../../api/client'
import { useAuth } from '../../auth/auth'
import { AuthImage } from '../../components/AuthMedia'
import { EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'

interface TileStatus { mlAvailable: boolean; configured: boolean; status: string; labels: string[] | null; modelCard: Record<string, unknown> | null }
interface TileResult {
  id: string; originalFileName: string; sizeBytes: number; uploadedBy: string | null; uploadedUtc: string
  outcome: 'Classified' | 'ModelNotConfigured' | 'MlUnavailable' | 'Failed'; label: string | null; confidence: number | null
  probabilities: Record<string, number> | null; modelName: string | null; modelVersion: string | null; message: string | null; imageUrl: string
}
interface Sample { id: string; image: string; title: string; documentedResult: { label: string; note: string } }

const MAX_BYTES = 10 * 1024 * 1024
const NOT_CLASSIFIED = { ModelNotConfigured: 'MODEL NOT CONFIGURED', MlUnavailable: 'ML SERVICE UNAVAILABLE', Failed: 'CLASSIFICATION FAILED' } as const

function Outcome({ r }: { r: TileResult }) {
  if (r.outcome === 'Classified')
    return (
      <div className="space-y-2">
        <p className="flex items-baseline gap-2"><span className="display text-xl font-semibold text-fg">{r.label}</span><span className="num text-sm text-muted">{((r.confidence ?? 0) * 100).toFixed(1)} % confidence</span></p>
        <ul className="space-y-1 text-xs text-muted">
          {Object.entries(r.probabilities ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <li key={k} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-2">
              <span className="truncate">{k}</span>
              <span className="h-1.5 rounded-full bg-line"><span className="block h-full rounded-full bg-accent" style={{ width: `${v * 100}%` }} /></span>
              <span className="num text-right">{(v * 100).toFixed(1)} %</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-subtle">Model {r.modelName} {r.modelVersion} — a model prediction, to be confirmed by an inspector.</p>
      </div>
    )
  return (
    <p role="alert" className="flex gap-2 font-bold text-warn">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{NOT_CLASSIFIED[r.outcome]}<span className="block text-xs font-normal text-muted">{r.message} The image was stored; no result was produced.</span></span>
    </p>
  )
}

export default function TileQualityPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const status = useQuery({ queryKey: ['tile-status'], queryFn: ({ signal }) => apiGet<TileStatus>('/api/tile-inspections/status', signal) })
  const history = useQuery({ queryKey: ['tile-history'], queryFn: ({ signal }) => apiGet<TileResult[]>('/api/tile-inspections', signal) })
  const samples = useQuery({ queryKey: ['tile-samples'], queryFn: ({ signal }) => apiGet<Sample[]>('/tile-samples/samples.json', signal), staleTime: Infinity })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [sampleMode, setSampleMode] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Revoke the last preview URL when leaving the page.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const upload = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData()
      form.append('file', f)
      return apiUpload<TileResult>('/api/tile-inspections', form)
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
    <Page>
      <PageHeader eyebrow="Quality & reliability" title="Tile Quality Inspection"
        description="Upload a tile photograph for defect classification by an ONNX model. Without a trained model the page says so plainly — it never invents a result."
        badges={status.isPending ? <span className="chip">Checking model…</span> : s && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${s.configured ? 'bg-ok/10 text-ok ring-ok/30' : 'bg-warn/12 text-warn ring-warn/35'}`}>
            {s.configured ? <CircleCheck className="size-3.5" aria-hidden="true" /> : <CircleAlert className="size-3.5" aria-hidden="true" />}
            {s.configured ? `Model ready: ${String(s.modelCard?.name ?? '')} ${String(s.modelCard?.version ?? '')}` : !s.mlAvailable ? 'ML SERVICE UNAVAILABLE' : 'MODEL NOT CONFIGURED'}
          </span>
        )}
        actions={
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-fg">
            <input type="checkbox" checked={sampleMode} onChange={(e) => setSampleMode(e.target.checked)} className="peer sr-only" />
            <span className="relative h-5 w-9 rounded-full bg-line-strong transition-colors peer-checked:bg-warn-fill peer-focus-visible:outline-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" aria-hidden="true" />
            <FlaskConical className="size-4 text-subtle" aria-hidden="true" />Sample demo mode
          </label>
        }
      />
      {s && !s.configured && s.mlAvailable && (
        <p className="rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-muted">{s.status}. See <span className="font-mono">docs/TILE-MODEL.md</span> to add a trained ONNX model (set TILE_MODEL_PATH). Uploads are stored but not classified.</p>
      )}

      {sampleMode ? (
        <Panel title="Sample demo mode — documented results for bundled synthetic images" icon={<FlaskConical className="size-4" />}>
          <p className="border-b border-warn/30 bg-warn/8 px-4 py-2 text-sm font-bold text-warn">SAMPLE RESULT — not a model prediction</p>
          {samples.isPending ? <Loading /> : samples.isError ? <ErrorState error={samples.error} /> : (
            <div className="grid gap-4 p-4 md:grid-cols-3">
              {samples.data.map((x) => (
                <figure key={x.id} className="overflow-hidden rounded-lg border border-line bg-sunken">
                  <img src={x.image} alt={`${x.title} (synthetic sample image)`} className="aspect-square w-full object-cover" />
                  <figcaption className="space-y-1 p-3 text-sm">
                    <p className="flex items-center justify-between gap-2"><b className="text-fg">{x.title}</b><span className="chip font-mono text-warn">{x.documentedResult.label}</span></p>
                    <span className="block text-xs text-muted">{x.documentedResult.note} SAMPLE RESULT — not a model prediction.</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Panel title="Upload tile image" icon={<ImageUp className="size-4" />}>
            <div className="space-y-3 p-4 text-sm">
              {!can('tiles.inspect') ? <EmptyState icon={false}>Your role can view tile inspections but not submit images.</EmptyState> : (
                <form onSubmit={(e) => { e.preventDefault(); if (file) upload.mutate(file) }} className="space-y-3">
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0] ?? null) }}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? 'border-accent bg-accent/8' : 'border-line-strong bg-sunken hover:border-subtle'}`}>
                    {preview
                      ? <img src={preview} alt="Preview of selected tile image" className="max-h-56 rounded-lg" />
                      : <Upload className="size-6 text-subtle" aria-hidden="true" />}
                    <span className="text-fg">{file ? file.name : 'Drop a tile image here, or choose a file'}</span>
                    <input type="file" accept="image/jpeg,image/png" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-label="Tile image (JPEG or PNG, max 10 MB)" className="file-input" />
                  </label>
                  {localError && <p role="alert" className="text-crit">{localError}</p>}
                  <div className="flex items-center gap-3">
                    <button type="submit" disabled={!file || upload.isPending} className="btn btn-primary"><ScanSearch className="size-4" aria-hidden="true" />{upload.isPending ? 'Uploading…' : 'Submit for inspection'}</button>
                    <p className="text-[11px] text-subtle">JPEG or PNG, max 10 MB. The server checks the file content, not just the extension.</p>
                  </div>
                </form>
              )}
              {upload.isError && <p role="alert" className="text-crit">{(upload.error as Error).message}</p>}
              {upload.data && <div className="rounded-lg border border-line bg-sunken p-4"><Outcome r={upload.data} /></div>}
            </div>
          </Panel>
          <Panel title="History" icon={<History className="size-4" />}>
            {history.isPending ? <Loading /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : history.data.length === 0 ? <EmptyState>No tile images inspected yet.</EmptyState> : (
              <ul>
                {history.data.map((r) => (
                  <li key={r.id} className="flex gap-3 border-b border-line/70 px-4 py-3 last:border-0">
                    <AuthImage src={r.imageUrl} alt={r.originalFileName} className="size-14 shrink-0 rounded-lg border border-line object-cover" />
                    <div className="min-w-0 text-xs">
                      <p className="truncate text-sm text-fg">{r.originalFileName}</p>
                      <p className="text-muted">{formatUtc(r.uploadedUtc)} · {r.uploadedBy}</p>
                      <p className="mt-0.5">{r.outcome === 'Classified'
                        ? <span className="font-semibold text-fg">{r.label} <span className="num font-normal text-muted">({((r.confidence ?? 0) * 100).toFixed(0)} %)</span></span>
                        : <span className="font-semibold text-warn">{r.outcome === 'MlUnavailable' ? 'ML service unavailable' : r.outcome === 'Failed' ? 'Failed' : NOT_CLASSIFIED.ModelNotConfigured}</span>}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </Page>
  )
}
