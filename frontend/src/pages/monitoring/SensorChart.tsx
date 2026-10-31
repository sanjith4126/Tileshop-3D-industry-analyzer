import { CircleHelp } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReadingsRange, SensorSeries, SeriesPoint } from '../../api/types'
import { useThemeColors } from '../../theme'

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

/** Runs of empty buckets as [start, end) in ms, so each gap can be shaded. */
function gapRanges(points: SeriesPoint[]) {
  const step = points.length > 1 ? Date.parse(points[1].t) - Date.parse(points[0].t) : 0
  const gaps: { from: number; to: number }[] = []
  points.forEach((p, i) => {
    if (p.count > 0) return
    const t = Date.parse(p.t)
    if (i > 0 && points[i - 1].count === 0) gaps[gaps.length - 1].to = t + step
    else gaps.push({ from: t, to: t + step })
  })
  return gaps
}

export function SensorChart({ series, range }: { series: SensorSeries; range: ReadingsRange }) {
  const c = useThemeColors()
  // Empty buckets stay null: line and band break there (never joined across a gap) and the gap is shaded.
  const data = series.points.map((p) => ({ t: Date.parse(p.t), avg: p.avg, band: p.min == null || p.max == null ? null : [p.min, p.max] as [number, number] }))
  const filled = series.points.filter((p) => p.count > 0)
  const gaps = gapRanges(series.points)
  const lines = limitLines(series)
  const values = [...filled.flatMap((p) => [p.min!, p.max!]), ...lines.map((l) => l.y)]
  const lo = Math.min(...values), hi = Math.max(...values), pad = (hi - lo) * 0.08 || 1
  const latest = filled.at(-1)
  // The newest bucket may still be filling; older than the previous bucket means no recent data.
  const stale = !latest || series.points.length < 2 || Date.parse(latest.t) < Date.parse(series.points[series.points.length - 2].t)
  const fmt = fmtTime(range)
  const axis = { stroke: c.line, tick: { fontSize: 10, fill: c.subtle }, tickLine: false }
  const span = data.length > 1 ? data[data.length - 1].t - data[0].t : 1
  // A reading with empty buckets on both sides has no line segment, so it is drawn as a dot.
  const lone = (i: number) => data[i]?.avg != null && data[i - 1]?.avg == null && data[i + 1]?.avg == null

  return (
    <figure className="card p-4">
      <figcaption className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-fg">{series.measurement}</p>
          <p className="text-xs text-subtle">
            {series.unit} · {range} · {filled.length} of {data.length} buckets with readings · <span className="font-semibold text-warn">SYNTHETIC DEMO DATA</span>
          </p>
        </div>
        {latest && (
          <p className="text-right">
            <span className="num text-xl font-semibold text-fg">{latest.avg}</span>
            <span className="ml-1 text-xs text-subtle">{series.unit}</span>
            <span className={`block text-[10px] ${stale ? 'font-semibold text-unk' : 'text-subtle'}`}>
              {stale ? `last reading ${fmt(Date.parse(latest.t))} UTC — no recent data` : 'latest avg'}
            </span>
          </p>
        )}
      </figcaption>
      {filled.length === 0 ? (
        <p className="flex h-44 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm text-unk">
          <CircleHelp className="size-4" aria-hidden="true" />No readings in this period — missing data (not Normal)
        </p>
      ) : (
        <div className="h-44" role="img"
          aria-label={`${series.measurement} over ${range}: ${filled.length} of ${data.length} buckets have readings${gaps.length ? `, ${gaps.length} gap(s) with no data` : ''}; limits: ${lines.map((l) => l.label).join(', ') || 'none'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 58, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={c.line} strokeOpacity={0.7} vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmt} minTickGap={40} {...axis} />
              <YAxis domain={[+(lo - pad).toFixed(2), +(hi + pad).toFixed(2)]} width={44} axisLine={false}
                tickFormatter={(v: number) => String(+v.toPrecision(3))} {...axis} />
              {gaps.map((g) => (
                <ReferenceArea key={g.from} x1={g.from} x2={g.to} fill={c['unk-fill']} fillOpacity={0.1} stroke={c['unk-fill']} strokeOpacity={0.35} strokeDasharray="3 3"
                  label={(g.to - g.from) / span >= 0.08 ? { value: 'No data', position: 'insideTop', fill: c['unk-fill'], fontSize: 10 } : undefined}
                  ifOverflow="hidden" />
              ))}
              <Tooltip
                cursor={{ stroke: c['line-strong'] }}
                contentStyle={{ background: c.surface, border: `1px solid ${c['line-strong']}`, borderRadius: 8, fontSize: 12, color: c.fg }}
                labelStyle={{ color: c.muted }}
                itemStyle={{ color: c.fg }}
                labelFormatter={(ms) => new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
                formatter={(v, name) => v == null
                  ? ['no data', name === 'band' ? 'min – max' : 'average']
                  : name === 'band'
                    ? [`${(v as number[])[0]} – ${(v as number[])[1]} ${series.unit}`, 'min – max']
                    : [`${v} ${series.unit}`, 'average']}
              />
              <Area dataKey="band" stroke="none" fill={c['series-1']} fillOpacity={0.16} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="avg" stroke={c['series-1']} strokeWidth={2} connectNulls={false}
                dot={({ cx, cy, index }) => lone(index) ? <circle key={index} cx={cx} cy={cy} r={2.5} fill={c['series-1']} /> : <g key={index} />}
                activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
              {lines.map((l) => (
                <ReferenceLine key={l.label} y={l.y} stroke={l.kind === 'Critical' ? c['crit-fill'] : c['warn-fill']} strokeDasharray={l.kind === 'Critical' ? '6 3' : '2 3'}
                  label={{ value: l.label, position: 'right', fill: c.muted, fontSize: 10 }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {filled.length > 0 && (
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer hover:text-fg">Table view</summary>
          <table className="data-table mt-1 font-mono">
            <thead><tr><th>Time (UTC)</th><th>Avg</th><th>Min</th><th>Max</th><th>Readings</th></tr></thead>
            <tbody>
              {series.points.slice(-12).reverse().map((p) => (
                <tr key={p.t}>
                  <td>{fmt(Date.parse(p.t))}</td>
                  {p.count > 0
                    ? <><td>{p.avg}</td><td>{p.min}</td><td>{p.max}</td></>
                    : <td colSpan={3} className="text-unk">no data</td>}
                  <td>{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1">Last 12 buckets shown. Empty buckets are gaps: nothing is interpolated.</p>
        </details>
      )}
    </figure>
  )
}
