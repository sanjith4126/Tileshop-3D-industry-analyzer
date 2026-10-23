import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReadingsRange, SensorSeries } from '../../api/types'
import { STATUS_META } from '../../lib/status'

const SERIES = '#3987e5' // categorical slot 1 (dark), one series per chart
const fmtTime = (range: ReadingsRange) => (ms: number) => {
  const d = new Date(ms).toISOString()
  return range === '7d' ? `${d.slice(5, 10)} ${d.slice(11, 13)}h` : d.slice(11, 16)
}

function limitLines(s: SensorSeries) {
  const lines: { y: number; kind: 'Warning' | 'Critical'; label: string }[] = []
  if (s.warningMax != null) lines.push({ y: s.warningMax, kind: 'Warning', label: `Warn ${s.warningMax}` })
  if (s.warningMin != null) lines.push({ y: s.warningMin, kind: 'Warning', label: `Warn ${s.warningMin}` })
  if (s.criticalMax != null) lines.push({ y: s.criticalMax, kind: 'Critical', label: `Crit ${s.criticalMax}` })
  if (s.criticalMin != null) lines.push({ y: s.criticalMin, kind: 'Critical', label: `Crit ${s.criticalMin}` })
  return lines
}

export function SensorChart({ series, range }: { series: SensorSeries; range: ReadingsRange }) {
  const data = series.points.map((p) => ({ t: Date.parse(p.t), avg: p.avg, band: [p.min, p.max] as [number, number] }))
  const lines = limitLines(series)
  const values = [...series.points.flatMap((p) => [p.min, p.max]), ...lines.map((l) => l.y)]
  const lo = Math.min(...values), hi = Math.max(...values), pad = (hi - lo) * 0.08 || 1
  const latest = series.points.at(-1)
  const fmt = fmtTime(range)

  return (
    <figure className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{series.measurement} <span className="font-normal text-slate-400">({series.unit})</span></span>
        <span className="font-mono text-xs text-slate-300">{latest ? `latest avg ${latest.avg} ${series.unit}` : ''}</span>
      </figcaption>
      {data.length === 0 ? (
        <p className="flex h-44 items-center justify-center text-sm text-purple-300">? No readings in this period — missing data (not Normal)</p>
      ) : (
        <div className="h-44" role="img" aria-label={`${series.measurement} over ${range}, ${data.length} points; limits: ${lines.map((l) => l.label).join(', ') || 'none'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 56, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmt}
                stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={40} />
              <YAxis domain={[+(lo - pad).toFixed(2), +(hi + pad).toFixed(2)]} stroke="#64748b" tick={{ fontSize: 10 }} width={44} tickFormatter={(v: number) => String(+v.toPrecision(3))} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 12 }}
                labelFormatter={(ms) => new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
                formatter={(v, name) => name === 'band'
                  ? [`${(v as number[])[0]} – ${(v as number[])[1]} ${series.unit}`, 'min – max']
                  : [`${v} ${series.unit}`, 'average']}
              />
              <Area dataKey="band" stroke="none" fill={SERIES} fillOpacity={0.18} isAnimationActive={false} />
              <Line dataKey="avg" stroke={SERIES} strokeWidth={2} dot={false} isAnimationActive={false} />
              {lines.map((l) => (
                <ReferenceLine key={l.label} y={l.y} stroke={STATUS_META[l.kind].color} strokeDasharray={l.kind === 'Critical' ? '6 3' : '2 3'}
                  label={{ value: `${STATUS_META[l.kind].icon} ${l.label}`, position: 'right', fill: '#cbd5e1', fontSize: 10 }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.length > 0 && (
        <details className="mt-1 text-xs text-slate-400">
          <summary className="cursor-pointer">Table view</summary>
          <table className="mt-1 w-full font-mono">
            <thead><tr className="text-left text-slate-500"><th>Time (UTC)</th><th>Avg</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>
              {series.points.slice(-12).reverse().map((p) => (
                <tr key={p.t}><td>{fmt(Date.parse(p.t))}</td><td>{p.avg}</td><td>{p.min}</td><td>{p.max}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1">Last 12 buckets shown.</p>
        </details>
      )}
    </figure>
  )
}
