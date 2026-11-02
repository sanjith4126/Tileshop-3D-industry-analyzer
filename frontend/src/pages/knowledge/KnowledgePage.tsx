import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Files, FileUp, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { apiGet, apiSend, apiUpload } from '../../api/client'
import { useAuth } from '../../auth/auth'
import { DemoBadge, EmptyState, ErrorState, Loading, Page, PageHeader, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'

interface Doc { id: string; title: string; fileName: string; contentType: string; sizeBytes: number; uploadedBy: string | null; uploadedUtc: string; status: 'Indexed' | 'Failed'; error: string | null; chunkCount: number; embedded: boolean; dataOrigin: 'Synthetic' | 'Real' }
interface SearchResult { mode: string; query: string; hits: { documentId: string; documentTitle: string; chunkIndex: number; snippet: string; score: number }[] }

/** Renders ts_headline output; matches are wrapped in « » by the server (plain text, no HTML injection). */
function Snippet({ text }: { text: string }) {
  return <>{text.split(/(«[^»]*»)/).map((p, i) => p.startsWith('«') ? <mark key={i} className="rounded-sm bg-warn/15 px-0.5 text-warn">{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>)}</>
}

export default function KnowledgePage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const docs = useQuery({ queryKey: ['documents'], queryFn: ({ signal }) => apiGet<{ searchMode: string; documents: Doc[] }>('/api/documents', signal) })
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')
  const search = useQuery({
    queryKey: ['doc-search', submitted],
    queryFn: ({ signal }) => apiGet<SearchResult>(`/api/documents/search?q=${encodeURIComponent(submitted)}`, signal),
    enabled: submitted.length > 0,
  })
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const refresh = () => { qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['doc-search'] }) }
  const tooBig = (file?.size ?? 0) > 10 * 1024 * 1024

  const upload = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('file', file!)
      if (title.trim()) form.append('title', title.trim())
      return apiUpload<Doc>('/api/documents', form)
    },
    onSuccess: () => { setFile(null); setTitle(''); refresh() },
  })
  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'reindex' | 'delete' }) =>
      kind === 'delete' ? apiSend('DELETE', `/api/documents/${id}`, undefined) : apiSend('POST', `/api/documents/${id}/reindex`, undefined),
    onSuccess: refresh,
  })

  return (
    <Page>
      <PageHeader eyebrow="Intelligence" title="Knowledge Centre"
        description="Procedures and reference documents, chunked and indexed for search. Every result names its source document and passage."
        badges={docs.data && <span className="chip"><Search className="size-3" aria-hidden="true" />{docs.data.searchMode}</span>} />

      <form onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()) }} role="search" className="card bg-blueprint flex flex-wrap gap-2 p-4">
        <label htmlFor="kq" className="sr-only">Search documents</label>
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-subtle" aria-hidden="true" />
          <input id="kq" value={q} maxLength={200} onChange={(e) => setQ(e.target.value)} placeholder="Search procedures, e.g. interlock, vibration…" className="input h-10 pl-9 text-sm" />
        </div>
        <button type="submit" className="btn btn-primary btn-lg">Search</button>
      </form>

      {submitted && (
        <Panel title={<>Results for “{submitted}”</>} icon={<Search className="size-4" />} actions={search.data && <span className="text-[11px] text-subtle">{search.data.mode}</span>}>
          {search.isPending ? <Loading /> : search.isError ? <ErrorState error={search.error} /> : search.data.hits.length === 0 ? <EmptyState>No matching passages.</EmptyState> : (
            <ol>
              {search.data.hits.map((h) => (
                <li key={`${h.documentId}-${h.chunkIndex}`} className="border-b border-line/70 px-4 py-3 text-sm last:border-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <FileText className="size-3.5 text-subtle" aria-hidden="true" />
                    <b className="text-fg">{h.documentTitle}</b><span>· passage {h.chunkIndex + 1}</span><span className="num">· score {h.score}</span>
                  </p>
                  <p className="mt-1 leading-relaxed text-fg"><Snippet text={h.snippet} /></p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title="Upload document" icon={<FileUp className="size-4" />}>
          {!can('knowledge.manage') ? <EmptyState icon={false}>Your role can search documents but not upload them.</EmptyState> : (
            <form onSubmit={(e) => { e.preventDefault(); if (file) upload.mutate() }} className="space-y-3 p-4 text-xs">
              <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" aria-label="Document (PDF, TXT or MD, max 10 MB)"
                onChange={(e) => { upload.reset(); setFile(e.target.files?.[0] ?? null) }} className="file-input" />
              <label className="block"><span className="field-label">Title (optional)</span>
                <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="input" />
              </label>
              <button type="submit" disabled={!file || upload.isPending || tooBig} className="btn btn-primary">{upload.isPending ? 'Indexing…' : 'Upload and index'}</button>
              {tooBig && <p role="alert" className="text-crit">File larger than 10 MB.</p>}
              {upload.isError && <p role="alert" className="text-crit">{(upload.error as Error).message}</p>}
              <p className="text-[11px] text-subtle">PDF, TXT or MD, max 10 MB, checked by content. Scanned PDFs need OCR first.</p>
            </form>
          )}
        </Panel>
        <Panel title={<>Documents {docs.data && <span className="num font-normal text-subtle">{docs.data.documents.length}</span>}</>} icon={<Files className="size-4" />} className="overflow-x-auto">
          {docs.isPending ? <Loading /> : docs.isError ? <ErrorState error={docs.error} onRetry={() => docs.refetch()} /> : docs.data.documents.length === 0 ? <EmptyState>No documents yet.</EmptyState> : (
            <table className="data-table">
              <thead><tr><th>Title</th><th>Index</th><th>Uploaded</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {docs.data.documents.map((d) => (
                  <tr key={d.id} className="align-top">
                    <td>
                      <span className="flex flex-wrap items-center gap-2 font-medium text-fg">{d.title}{d.dataOrigin === 'Synthetic' && <DemoBadge />}</span>
                      <span className="block text-xs text-subtle">{d.fileName} · {(d.sizeBytes / 1024).toFixed(1)} KB</span>
                    </td>
                    <td className="text-xs">
                      <span className={`chip ${d.status === 'Indexed' ? 'text-ok' : 'text-warn'}`}>{d.status}</span>
                      <span className="mt-1 block text-muted">{d.chunkCount} passage(s) · {d.embedded ? 'embedded' : 'keyword index'}</span>
                      {d.error && <span className="block text-warn">{d.error}</span>}
                    </td>
                    <td className="text-xs whitespace-nowrap text-muted">{formatUtc(d.uploadedUtc)}<span className="block">{d.uploadedBy}</span></td>
                    <td className="text-right whitespace-nowrap">
                      {can('knowledge.manage') && <button onClick={() => action.mutate({ id: d.id, kind: 'reindex' })} className="btn btn-ghost btn-sm"><RefreshCw className="size-3.5" aria-hidden="true" />Re-index</button>}
                      {can('knowledge.manage') && <button onClick={() => { if (window.confirm(`Delete "${d.title}"?`)) action.mutate({ id: d.id, kind: 'delete' }) }} className="btn btn-danger btn-sm ml-1"><Trash2 className="size-3.5" aria-hidden="true" />Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {action.isError && <p role="alert" className="px-4 pb-3 text-xs text-crit">{(action.error as Error).message}</p>}
        </Panel>
      </div>
    </Page>
  )
}
