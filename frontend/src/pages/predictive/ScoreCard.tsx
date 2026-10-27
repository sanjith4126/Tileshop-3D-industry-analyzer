import { CircleCheck, Flag, ServerOff } from 'lucide-react'
import type { AnomalyScore, MlStatus } from '../../api/types'
import { formatUtc } from '../../lib/status'

const pct = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`

/** Score over time with the threshold drawn as a dashed line; each point has a hover tooltip. */
function ScoreHistory({ history, threshold }: { history: AnomalyScore[]; threshold: number }) {
  if (history.length < 2) return null
  const pts = [...history].sort((a, b) => Date.parse(a.timestampUtc) - Date.parse(b.timestampUtc))
  const vals = pts.map((p) => p.score)
  const lo = Math.min(...vals, threshold) - 0.02, hi = Math.max(...vals, threshold) + 0.02
  const t0 = Date.parse(pts[0].timestampUtc), span = Date.parse(pts.at(-1)!.timestampUtc) - t0 || 1
  const x = (p: AnomalyScore) => ((Date.parse(p.timestampUtc) - t0) / span) * 100
  const y = (v: number) => 38 - ((v - lo) / (hi - lo)) * 36
  const w = 100 / pts.length
  return (
    <figure>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-16 w-full overflow-visible" role="img"
        aria-label={`Anomaly score history: ${pts.length} scores from ${formatUtc(pts[0].timestampUtc)}, latest ${vals.at(-1)!.toFixed(3)}, threshold ${threshold.toFixed(3)}`}>
        <line x1="0" x2="100" y1={y(threshold)} y2={y(threshold)} style={{ stroke: 'var(--warn-fill)' }} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        <polyline points={pts.map((p) => `${x(p)},${y(p.score)}`).join(' ')} fill="none" style={{ stroke: 'var(--series-1)' }} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {pts.map((p) => (
          <rect key={p.timestampUtc} x={x(p) - w / 2} y="0" width={w} height="40" fill="transparent" className="hover:fill-fg/5">
            <title>{`${formatUtc(p.timestampUtc)} · score ${p.score.toFixed(3)}${p.isAnomaly ? ' · anomaly' : ''}`}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-subtle">
        <span>{formatUtc(pts[0].timestampUtc)}</span><span>score history · dashed = threshold</span><span>{formatUtc(pts.at(-1)!.timestampUtc)}</span>
      </figcaption>
    </figure>
  )
}

/** Model score with a plain-English explanation. Never shows a score the ML service did not produce. */
export function ScoreCard({ score, ml, history = [] }: { score: AnomalyScore | null; ml: MlStatus; history?: AnomalyScore[] }) {
  if (!score)
    return (
      <div className="space-y-2 p-4 text-sm">
        {!ml.available && ml.lastCheckedUtc
          ? <p role="alert" className="flex items-center gap-2 font-semibold text-warn"><ServerOff className="size-4" aria-hidden="true" />ML service unavailable — no anomaly score.</p>
          : <p className="text-fg">No anomaly score in the last 24 h.</p>}
        <p className="text-xs text-subtle">A score is only produced when the ML service is reachable and every sensor has at least 45 of the last 60 minutes of data.</p>
      </div>
    )

  const top = score.topDeviations[0]
  return (
    <div className="space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`num text-[34px] leading-none font-semibold ${score.isAnomaly ? 'text-warn' : 'text-fg'}`}>{score.score.toFixed(3)}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${score.isAnomaly ? 'bg-warn/12 text-warn ring-warn/35' : 'bg-ok/10 text-ok ring-ok/30'}`}>
          {score.isAnomaly ? <Flag className="size-3.5" aria-hidden="true" /> : <CircleCheck className="size-3.5" aria-hidden="true" />}
          {score.isAnomaly ? 'Statistical anomaly' : 'Within normal pattern'}
        </span>
        {!score.isFresh && <span className="chip text-warn">stale · {formatUtc(score.timestampUtc)}</span>}
      </div>

      <div>
        <div className="relative h-2 rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: pct(score.score), background: score.isAnomaly ? 'var(--warn-fill)' : 'var(--series-1)' }} />
          <div className="absolute -top-1 h-4 w-0.5 rounded bg-fg" style={{ left: pct(score.threshold) }} />
        </div>
        <p className="mt-1 flex justify-between text-[10px] text-subtle"><span>0 · typical</span><span>threshold {score.threshold.toFixed(3)}</span><span>1 · highly unusual</span></p>
      </div>

      <p className="text-fg">
        {score.isAnomaly
          ? 'The last 60 minutes of readings look unusual compared with the normal operation the model was trained on. '
          : 'The last 60 minutes of readings look like the normal operation the model was trained on. '}
        This is a statistical measure of how unusual the data is — not a diagnosis, and not a prediction of when a failure will happen.
      </p>
      {top && (
        <p className="text-xs text-muted">
          Largest deviation: <span className="font-mono">{top.feature}</span> = {top.value} (z = {top.zScore}, i.e. {Math.abs(top.zScore)} standard deviations from the training average).
          Other: {score.topDeviations.slice(1).map((d) => `${d.feature} (z ${d.zScore})`).join(', ') || '—'}.
        </p>
      )}
      <ScoreHistory history={history} threshold={score.threshold} />
      <p className="text-[11px] text-subtle">
        Model {score.modelVersion} · scored {formatUtc(score.timestampUtc)} · flagged when the Isolation Forest score exceeds its threshold
        or a feature exceeds |z| {score.zThreshold?.toFixed(1)} · trained on synthetic data only (see docs/ML-EVALUATION.md).
      </p>
    </div>
  )
}
