import type { AnomalyScore, MlStatus } from '../../api/types'
import { formatUtc } from '../../lib/status'

/** Model score with a plain-English explanation. Never shows a score the ML service did not produce. */
export function ScoreCard({ score, ml }: { score: AnomalyScore | null; ml: MlStatus }) {
  if (!score)
    return (
      <div className="space-y-1 p-3 text-sm">
        {!ml.available && ml.lastCheckedUtc
          ? <p role="alert" className="font-semibold text-amber-300">ML service unavailable — no anomaly score.</p>
          : <p className="text-slate-300">No anomaly score in the last 24 h.</p>}
        <p className="text-xs text-slate-500">A score is only produced when the ML service is reachable and every sensor has at least 45 of the last 60 minutes of data.</p>
      </div>
    )

  const top = score.topDeviations[0]
  return (
    <div className="space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className={`text-2xl font-semibold tabular-nums ${score.isAnomaly ? 'text-amber-300' : 'text-slate-100'}`}>{score.score.toFixed(3)}</span>
        <span className="text-xs text-slate-400">threshold {score.threshold.toFixed(3)}</span>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${score.isAnomaly ? 'bg-amber-500/15 text-amber-300 ring-amber-500/40' : 'bg-slate-700/40 text-slate-300 ring-slate-600'}`}>
          {score.isAnomaly ? '! Statistical anomaly' : '✓ Within normal pattern'}
        </span>
        {!score.isFresh && <span className="text-xs text-amber-300">stale ({formatUtc(score.timestampUtc)})</span>}
      </div>
      <p className="text-slate-300">
        {score.isAnomaly
          ? 'The last 60 minutes of readings look unusual compared with the normal operation the model was trained on. '
          : 'The last 60 minutes of readings look like the normal operation the model was trained on. '}
        This is a statistical measure of how unusual the data is — not a diagnosis, and not a prediction of when a failure will happen.
      </p>
      {top && (
        <p className="text-xs text-slate-400">
          Largest deviation: <span className="font-mono">{top.feature}</span> = {top.value} (z = {top.zScore}, i.e. {Math.abs(top.zScore)} standard deviations from the training average).
          Other: {score.topDeviations.slice(1).map((d) => `${d.feature} (z ${d.zScore})`).join(', ') || '—'}.
        </p>
      )}
      <p className="text-[11px] text-slate-500">
        Model {score.modelVersion} · scored {formatUtc(score.timestampUtc)} · flagged when the Isolation Forest score exceeds its threshold
        or a feature exceeds |z| {score.zThreshold?.toFixed(1)} · trained on synthetic data only (see docs/ML-EVALUATION.md).
      </p>
    </div>
  )
}
