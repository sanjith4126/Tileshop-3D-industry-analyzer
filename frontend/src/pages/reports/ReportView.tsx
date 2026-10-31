import { ArrowLeft, Download } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useReport } from '../../api/hooks'
import type { Report } from '../../api/types'
import { ErrorState, Loading, Page } from '../../components/States'
import { formatUtc } from '../../lib/status'

/** Browser rendering of a stored report document (same content as the PDF). */
export function ReportBody({ report }: { report: Report }) {
  const d = report.document
  return (
    <article className="card mx-auto max-w-5xl overflow-hidden text-sm">
      {d.dataClassification === 'SYNTHETIC' && (
        <p className="hazard px-4 py-1.5 text-center text-xs font-bold tracking-[0.12em]">SYNTHETIC DEMO DATA — TileTwin Demonstration Facility (fictional)</p>
      )}
      <div className="space-y-7 p-8">
        <header className="border-b border-line pb-5">
          <p className="eyebrow">TileTwin report · {report.status}</p>
          <h1 className="display mt-1 text-2xl font-semibold text-fg">{d.title}</h1>
          <p className="mt-2 text-xs text-muted">
            Generated {formatUtc(d.generatedUtc)} by {report.generatedBy ?? 'unknown'} · period {formatUtc(d.fromUtc)} → {formatUtc(d.toUtc)}
          </p>
          {Object.keys(d.filters).length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">{Object.entries(d.filters).map(([k, v]) => <span key={k} className="chip">{k}: {v}</span>)}</p>
          )}
        </header>
        <section>
          <h2 className="eyebrow mb-2">Summary</h2>
          <ul className="space-y-1.5 rounded-lg border border-line bg-sunken p-4 text-fg">
            {d.summary.map((s, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" /><span>{s}</span></li>)}
          </ul>
        </section>
        {d.sections.map((s) => (
          <section key={s.heading} className="space-y-2">
            <h2 className="display text-base font-semibold text-fg">{s.heading}</h2>
            {s.paragraphs.map((p, i) => <p key={i} className="leading-relaxed text-fg">{p}</p>)}
            {s.table && (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="data-table text-xs">
                  <thead><tr>{s.table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="align-top">{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        ))}
        <section>
          <h2 className="eyebrow mb-2">Recommendations</h2>
          <ol className="list-decimal space-y-1 pl-5 text-fg marker:text-subtle">{d.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>
        </section>
        <p className="border-t border-line pt-4 text-xs text-subtle">Data source: {d.dataSource}</p>
      </div>
    </article>
  )
}

export default function ReportViewPage() {
  const { id = '' } = useParams()
  const q = useReport(id)
  if (q.isPending) return <Loading label="Loading report…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  return (
    <Page>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Link to="/reports" className="btn btn-ghost"><ArrowLeft className="size-4" aria-hidden="true" />All reports</Link>
        <a href={`/api/reports/${id}/pdf`} download className="btn btn-primary"><Download className="size-4" aria-hidden="true" />Download PDF</a>
      </div>
      <ReportBody report={q.data} />
    </Page>
  )
}
