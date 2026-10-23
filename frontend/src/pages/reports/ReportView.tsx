import { Link, useParams } from 'react-router'
import { useReport } from '../../api/hooks'
import type { Report } from '../../api/types'
import { ErrorState, Loading } from '../../components/States'
import { formatUtc } from '../../lib/status'

/** Browser rendering of a stored report document (same content as the PDF). */
export function ReportBody({ report }: { report: Report }) {
  const d = report.document
  return (
    <article className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/70 p-5 text-sm">
      {d.containsSyntheticData && (
        <p className="rounded bg-amber-500 px-3 py-1 text-center text-xs font-bold text-slate-950">SYNTHETIC DATA — TileTwin Demonstration Facility (fictional)</p>
      )}
      <header>
        <h2 className="text-xl font-semibold">{d.title}</h2>
        <p className="text-xs text-slate-400">
          Generated {formatUtc(d.generatedUtc)} by {report.generatedBy ?? 'unknown'} · {report.status} · period {formatUtc(d.fromUtc)} → {formatUtc(d.toUtc)}
          {Object.entries(d.filters).map(([k, v]) => ` · ${k}: ${v}`).join('')}
        </p>
      </header>
      <section>
        <h3 className="mb-1 font-semibold">Summary</h3>
        <ul className="list-disc space-y-0.5 pl-5">{d.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </section>
      {d.sections.map((s) => (
        <section key={s.heading} className="space-y-1">
          <h3 className="font-semibold">{s.heading}</h3>
          {s.paragraphs.map((p, i) => <p key={i} className="text-slate-300">{p}</p>)}
          {s.table && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800/60 text-left"><tr>{s.table.columns.map((c) => <th key={c} className="px-2 py-1 font-semibold">{c}</th>)}</tr></thead>
                <tbody>{s.table.rows.map((r, i) => <tr key={i} className="border-t border-slate-800">{r.map((c, j) => <td key={j} className="px-2 py-1 align-top">{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      ))}
      <section>
        <h3 className="mb-1 font-semibold">Recommendations</h3>
        <ul className="list-disc space-y-0.5 pl-5">{d.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </section>
      <p className="text-xs text-slate-500">Data source: {d.dataSource}</p>
    </article>
  )
}

export default function ReportViewPage() {
  const { id = '' } = useParams()
  const q = useReport(id)
  if (q.isPending) return <Loading label="Loading report…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  return (
    <div className="space-y-3 p-5">
      <nav className="flex items-center gap-3 text-xs text-slate-400">
        <Link to="/reports" className="hover:underline">Reports</Link> / {q.data.document.title}
        <a href={`/api/reports/${id}/pdf`} download className="ml-auto rounded bg-cyan-700 px-3 py-1.5 font-semibold text-white hover:bg-cyan-600">Download PDF</a>
      </nav>
      <ReportBody report={q.data} />
    </div>
  )
}
