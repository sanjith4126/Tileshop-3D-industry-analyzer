import { CircleHelp } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReadingsRange, SensorSeries } from '../../api/types'
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

export function SensorChart({ series, range }: { series: SensorSeries; range: ReadingsRange }) {
  const c = useThemeColors()
  const data = series.points.map((p) => ({ t: Date.parse(p.t), avg: p.avg, band: [p.min, p.max] as [number, number] }))
  const lines = limitLines(series)
  const values = [...series.points.flatMap((p) => [p.min, p.max]), ...lines.map((l) => l.y)]
  const lo = Math.min(...values), hi = Math.max(...values), pad = (hi - lo) * 0.08 || 1
  const latest = series.points.at(-1)
  const fmt = fmtTime(range)
  const axis = { stroke: c.line, tick: { fontSize: 10, fill: c.subtle }, tickLine: false }

  return (
    <figure className="card p-4">
      <figcaption className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-fg">{series.measurement}</p>
          <p className="text-xs text-subtle">{series.unit} · {range} · {data.length} points</p>
        </div>
        {latest && (
          <p className="text-right">
            <span className="num text-xl font-semibold text-fg">{latest.avg}</span>
            <span className="ml-1 text-xs text-subtle">{series.unit}</span>
            <span className="block text-[10px] text-subtle">latest avg</span>
          </p>
        )}
      </figcaption>
      {data.length === 0 ? (
        <p className="flex h-44 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm text-unk">
          <CircleHelp className="size-4" aria-hidden="true" />No readings in this period — missing data (not Normal)
        </p>
      ) : (
        <div className="h-44" role="img" aria-label={`${series.measurement} over ${range}, ${data.length} points; limits: ${lines.map((l) => l.label).join(', ') || 'none'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 58, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={c.line} strokeOpacity={0.7} vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmt} minTickGap={40} {...axis} />
              <YAxis domain={[+(lo - pad).toFixed(2), +(hi + pad).toFixed(2)]} width={44} axisLine={false}
                tickFormatter={(v: number) => String(+v.toPrecision(3))} {...axis} />
              <Tooltip
                cursor={{ stroke: c['line-strong'] }}
                contentStyle={{ background: c.surface, border: `1px solid ${c['line-strong']}`, borderRadius: 8, fontSize: 12, color: c.fg }}
                labelStyle={{ color: c.muted }}
                itemStyle={{ color: c.fg }}
                labelFormatter={(ms) => new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
                formatter={(v, name) => name === 'band'
                  ? [`${(v as number[])[0]} – ${(v as number[])[1]} ${series.unit}`, 'min – max']
                  : [`${v} ${series.unit}`, 'average']}
              />
              <Area dataKey="band" stroke="none" fill={c['series-1']} fillOpacity={0.16} isAnimationActive={false} />
              <Line dataKey="avg" stroke={c['series-1']} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
              {lines.map((l) => (
                <ReferenceLine key={l.label} y={l.y} stroke={l.kind === 'Critical' ? c['crit-fill'] : c['warn-fill']} strokeDasharray={l.kind === 'Critical' ? '6 3' : '2 3'}
                  label={{ value: l.label, position: 'right', fill: c.muted, fontSize: 10 }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.length > 0 && (
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer hover:text-fg">Table view</summary>
          <table className="data-table mt-1 font-mono">
            <thead><tr><th>Time (UTC)</th><th>Avg</th><th>Min</th><th>Max</th></tr></thead>
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
