import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, apiGet, apiSend } from '../../api/client'
import { useAuth } from '../../auth/auth'
import { DemoBadge, EmptyState, ErrorState, Loading, Panel } from '../../components/States'
import { formatUtc } from '../../lib/status'

interface Doc { id: string; title: string; fileName: string; contentType: string; sizeBytes: number; uploadedBy: string | null; uploadedUtc: string; status: 'Indexed' | 'Failed'; error: string | null; chunkCount: number; embedded: boolean; dataOrigin: 'Synthetic' | 'Real' }
interface Search { mode: string; query: string; hits: { documentId: string; documentTitle: string; chunkIndex: number; snippet: string; score: number }[] }

/** Renders ts_headline output; matches are wrapped in « » by the server (plain text, no HTML injection). */
function Snippet({ text }: { text: string }) {
  return <>{text.split(/(«[^»]*»)/).map((p, i) => p.startsWith('«') ? <mark key={i} className="bg-amber-500/30 text-amber-100">{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>)}</>
}

export default function KnowledgePage() {
  const { session, hasRole } = useAuth()
  const qc = useQueryClient()
  const docs = useQuery({ queryKey: ['documents'], queryFn: ({ signal }) => apiGet<{ searchMode: string; documents: Doc[] }>('/api/documents', signal) })
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')
  const search = useQuery({
    queryKey: ['doc-search', submitted],
    queryFn: ({ signal }) => apiGet<Search>(`/api/documents/search?q=${encodeURIComponent(submitted)}`, signal),
    enabled: submitted.length > 0,
  })
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const refresh = () => { qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['doc-search'] }) }

  const upload = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('file', file!)
      if (title.trim()) form.append('title', title.trim())
      const res = await fetch('/api/documents', { method: 'POST', body: form, headers: { Authorization: `Bearer ${session?.token}` } })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { errors?: Record<string, string[]> } | null
        throw new ApiError(res.status, res.status === 403 ? 'Your role cannot upload' : body?.errors?.file?.[0] ?? `Upload failed (${res.status})`)
      }
      return (await res.json()) as Doc
    },
    onSuccess: () => { setFile(null); setTitle(''); refresh() },
  })
  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'reindex' | 'delete' }) =>
      kind === 'delete' ? apiSend('DELETE', `/api/documents/${id}`, undefined, session?.token ?? null) : apiSend('POST', `/api/documents/${id}/reindex`, undefined, session?.token ?? null),
    onSuccess: refresh,
  })

  return (
    <div className="space-y-4 p-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Knowledge Centre</h1>
        {docs.data && <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{docs.data.searchMode}</span>}
      </header>

      <form onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()) }} role="search" className="flex gap-2">
        <label htmlFor="kq" className="sr-only">Search documents</label>
        <input id="kq" value={q} maxLength={200} onChange={(e) => setQ(e.target.value)} placeholder="Search procedures, e.g. interlock, vibration…"
          className="w-96 max-w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm" />
        <button type="submit" className="rounded bg-cyan-700 px-3 py-1.5 text-sm font-semibold hover:bg-cyan-600">Search</button>
      </form>
      {submitted && (
        <Panel title={search.data ? `Results — ${search.data.mode}` : 'Results'}>
          {search.isPending ? <Loading /> : search.isError ? <ErrorState error={search.error} /> : search.data.hits.length === 0 ? <EmptyState>No matching passages.</EmptyState> : (
            <ol>
              {search.data.hits.map((h) => (
                <li key={`${h.documentId}-${h.chunkIndex}`} className="border-t border-slate-800/70 px-3 py-2 text-sm first:border-0">
                  <p className="text-xs text-slate-400">Source: <b className="text-slate-200">{h.documentTitle}</b> · passage {h.chunkIndex + 1} · score {h.score}</p>
                  <p className="mt-0.5"><Snippet text={h.snippet} /></p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Panel title="Upload document">
          {!hasRole('Inspector', 'MaintenanceEngineer', 'Admin') ? <p className="p-3 text-xs text-slate-400">Sign in as Inspector, Maintenance Engineer or Admin to upload.</p> : (
            <form onSubmit={(e) => { e.preventDefault(); if (file) upload.mutate() }} className="space-y-2 p-3 text-xs">
              <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" aria-label="Document (PDF, TXT or MD, max 10 MB)"
                onChange={(e) => { upload.reset(); setFile(e.target.files?.[0] ?? null) }} className="block file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-100" />
              <label className="block">Title (optional)
                <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              </label>
              <button type="submit" disabled={!file || upload.isPending || (file?.size ?? 0) > 10 * 1024 * 1024} className="rounded bg-cyan-700 px-3 py-1.5 font-semibold hover:bg-cyan-600 disabled:opacity-50">
                {upload.isPending ? 'Indexing…' : 'Upload and index'}
              </button>
              {(file?.size ?? 0) > 10 * 1024 * 1024 && <p role="alert" className="text-red-300">File larger than 10 MB.</p>}
              {upload.isError && <p role="alert" className="text-red-300">{(upload.error as Error).message}</p>}
              <p className="text-[11px] text-slate-500">PDF, TXT or MD, max 10 MB, checked by content. Scanned PDFs need OCR first.</p>
            </form>
          )}
        </Panel>
        <Panel title="Documents">
          {docs.isPending ? <Loading /> : docs.isError ? <ErrorState error={docs.error} onRetry={() => docs.refetch()} /> : docs.data.documents.length === 0 ? <EmptyState>No documents yet.</EmptyState> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2 font-normal">Title</th><th className="font-normal">Status</th><th className="font-normal">Uploaded</th><th /></tr></thead>
              <tbody>
                {docs.data.documents.map((d) => (
                  <tr key={d.id} className="border-t border-slate-800/70 align-top">
                    <td className="px-3 py-2">{d.title} {d.dataOrigin === 'Synthetic' && <DemoBadge />}<span className="block text-xs text-slate-500">{d.fileName} · {(d.sizeBytes / 1024).toFixed(1)} KB</span></td>
                    <td className="text-xs">{d.status} · {d.chunkCount} passage(s){d.embedded ? ' · embedded' : ' · keyword index'}{d.error && <span className="block text-amber-300">{d.error}</span>}</td>
                    <td className="text-xs text-slate-400">{formatUtc(d.uploadedUtc)}<br />{d.uploadedBy}</td>
                    <td className="space-x-1 pr-3 text-right whitespace-nowrap">
                      {hasRole('Inspector', 'MaintenanceEngineer', 'Admin') && <button onClick={() => action.mutate({ id: d.id, kind: 'reindex' })} className="rounded bg-slate-800 px-2 py-0.5 text-xs hover:bg-slate-700">Re-index</button>}
                      {hasRole('MaintenanceEngineer', 'Admin') && <button onClick={() => { if (window.confirm(`Delete "${d.title}"?`)) action.mutate({ id: d.id, kind: 'delete' }) }} className="rounded bg-red-900/60 px-2 py-0.5 text-xs hover:bg-red-800">Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {action.isError && <p role="alert" className="px-3 pb-2 text-xs text-red-300">{(action.error as Error).message}</p>}
        </Panel>
      </div>
    </div>
  )
}
