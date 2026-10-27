import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useZones } from '../../api/hooks'
import type { MachineSummary } from '../../api/types'
import { STATUS_META, shortId, statusVar } from '../../lib/status'
import { focusEntity } from '../../store/focus'
import { useManifest } from '../../twin/manifest'

const MACHINE_TYPES = new Set(['HydraulicPress', 'Pump', 'Motor', 'Conveyor', 'InspectionStation'])

/** Approximate advance (drawing units) of one uppercase label glyph at fontSize 1.15, incl. letter spacing. */
const CH = 0.9

/** Greedy word wrap so zone names stay inside their zone; a single long word is squeezed via textLength. */
function wrap(text: string, max: number) {
  const lines: string[] = []
  // Keep connectors with the following word ("+ STORAGE"), so a line never holds a lone "+" or "&".
  const words = text.split(' ').reduce<string[]>((acc, w) => (/^[+&]$/.test(acc.at(-1) ?? '') ? [...acc.slice(0, -1), `${acc.at(-1)} ${w}`] : [...acc, w]), [])
  for (const word of words) {
    const last = lines.at(-1)
    if (last != null && (last.length + 1 + word.length) * CH <= max) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

/**
 * Top-down "general arrangement" drawing of the plant from the 3D asset manifest (metres, illustrative).
 * Markers are coloured by live status; selecting one flies the 3D twin to that machine.
 */
export function PlantBlueprint({ machines }: { machines: MachineSummary[] }) {
  const manifest = useManifest()
  const zones = useZones()
  const navigate = useNavigate()
  const [hover, setHover] = useState<string | null>(null)

  if (manifest.isPending) return <div className="h-full min-h-64 animate-pulse rounded-lg bg-raised/60" aria-label="Loading plant drawing" />
  if (!manifest.data) return <p className="p-4 text-sm text-subtle">Plant drawing unavailable.</p>

  const byId = new Map(machines.map((m) => [m.id, m]))
  const zoneName = new Map((zones.data ?? []).map((z) => [z.id, z.name]))
  const [bw, , bd] = manifest.data.building.size
  const entities = Object.entries(manifest.data.entities)
  const open = (id: string) => { focusEntity(id); navigate('/twin') }
  const hovered = hover ? byId.get(hover) : undefined

  return (
    <figure className="relative flex h-full flex-col">
      <svg viewBox={`${-bw / 2 - 6} ${-bd / 2 - 6} ${bw + 12} ${bd + 11}`} className="w-full flex-1 select-none" role="group"
        aria-label={`Plant drawing with ${machines.length} machines. Select a machine to open it in the 3D twin.`}>
        <defs>
          <pattern id="bp-hatch" patternUnits="userSpaceOnUse" width="1.2" height="1.2" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="1.2" className="stroke-line-strong" strokeWidth="0.3" />
          </pattern>
          <marker id="bp-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" className="fill-accent" />
          </marker>
        </defs>

        {/* Dimension lines (illustrative) */}
        <g className="stroke-subtle" strokeWidth="0.12" fill="none">
          <line x1={-bw / 2} y1={-bd / 2 - 3.2} x2={bw / 2} y2={-bd / 2 - 3.2} />
          <line x1={-bw / 2} y1={-bd / 2 - 4.2} x2={-bw / 2} y2={-bd / 2 - 2.2} />
          <line x1={bw / 2} y1={-bd / 2 - 4.2} x2={bw / 2} y2={-bd / 2 - 2.2} />
          <line x1={-bw / 2 - 3.2} y1={-bd / 2} x2={-bw / 2 - 3.2} y2={bd / 2} />
          <line x1={-bw / 2 - 4.2} y1={-bd / 2} x2={-bw / 2 - 2.2} y2={-bd / 2} />
          <line x1={-bw / 2 - 4.2} y1={bd / 2} x2={-bw / 2 - 2.2} y2={bd / 2} />
        </g>
        <text x="0" y={-bd / 2 - 3.8} textAnchor="middle" className="fill-subtle font-mono" fontSize="1.25">{bw} m · illustrative</text>
        <text x={-bw / 2 - 4} y="0" textAnchor="middle" className="fill-subtle font-mono" fontSize="1.25" transform={`rotate(-90 ${-bw / 2 - 4} 0)`}>{bd} m</text>

        {/* Building shell + columns */}
        <rect x={-bw / 2} y={-bd / 2} width={bw} height={bd} rx="0.6" className="fill-sunken/60 stroke-line-strong" strokeWidth="0.35" />
        {Array.from({ length: 9 }, (_, i) => -bw / 2 + (i * bw) / 8).map((x) => (
          <rect key={x} x={x - 0.4} y={-bd / 2 - 0.4} width="0.8" height="0.8" className="fill-line-strong" />
        ))}

        {entities.map(([id, e]) => {
          const [x, , z] = e.position
          if (e.type === 'Zone') {
            const [w, , d] = e.scale
            return (
              <g key={id} className="group cursor-pointer" onClick={() => open(id)} role="button" tabIndex={0}
                aria-label={`Zone ${zoneName.get(id) ?? id}, open in 3D`} onKeyDown={(ev) => ev.key === 'Enter' && open(id)}>
                <rect x={x - w / 2 + 0.3} y={z - d / 2} width={w - 0.6} height={d} rx="0.5"
                  className="fill-accent/3 stroke-accent/35 transition-colors group-hover:fill-accent/8 group-focus-visible:stroke-accent" strokeWidth="0.15" strokeDasharray="0.8 0.5" />
                <text x={x - w / 2 + 1.2} y={z - d / 2 + 2} className="fill-muted font-sans" fontSize="1.15" fontWeight="600" letterSpacing="0.12">
                  {wrap((zoneName.get(id) ?? id).toUpperCase(), w - 2.4).map((line, i) => (
                    <tspan key={i} x={x - w / 2 + 1.2} dy={i ? 1.45 : 0}
                      {...(line.length * CH > w - 2.4 ? { textLength: w - 2.4, lengthAdjust: 'spacingAndGlyphs' } : {})}>{line}</tspan>
                  ))}
                </text>
              </g>
            )
          }
          if (e.type === 'Kiln') {
            const [l, , d] = e.scale
            return (
              <g key={id}>
                <rect x={x - l / 2} y={z - d / 2} width={l} height={d} rx="0.4" fill="url(#bp-hatch)" className="stroke-line-strong" strokeWidth="0.25" />
                <text x={x} y={z + 0.45} textAnchor="middle" className="fill-subtle font-mono" fontSize="1.2" letterSpacing="0.3">ROLLER KILN</text>
              </g>
            )
          }
          if (e.type === 'RackRow')
            return <rect key={id} x={x - 5.2} y={z - 0.9} width="10.4" height="1.8" rx="0.2" fill="url(#bp-hatch)" className="stroke-line-strong" strokeWidth="0.2" />
          return null
        })}

        {/* Process flow */}
        <line x1={-bw / 2 + 4} y1={bd / 2 - 1.6} x2={bw / 2 - 12} y2={bd / 2 - 1.6} className="stroke-accent/60" strokeWidth="0.18" strokeDasharray="1.2 0.8" markerEnd="url(#bp-arrow)" />
        <text x={-bw / 2 + 4} y={bd / 2 - 2.4} className="fill-accent/80 font-mono" fontSize="1" letterSpacing="0.25">PROCESS FLOW</text>

        {/* Machines */}
        {entities.filter(([, e]) => MACHINE_TYPES.has(e.type)).map(([id, e]) => {
          const m = byId.get(id)
          const status = m?.status ?? 'Unknown'
          const [x, , z] = e.position
          const isConveyor = e.type === 'Conveyor'
          const focus = hover === id
          const showLabel = status !== 'Normal' || focus
          return (
            <g key={id} className="cursor-pointer outline-none" role="button" tabIndex={0}
              aria-label={`${m?.name ?? id}, ${STATUS_META[status].label}. Open in 3D twin.`}
              onClick={() => open(id)} onKeyDown={(ev) => ev.key === 'Enter' && open(id)}
              onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(id)} onBlur={() => setHover(null)}>
              {isConveyor && (
                <rect x={x - e.scale[0] / 2} y={z - 0.45} width={e.scale[0]} height="0.9" rx="0.45" className="fill-line-strong/70" />
              )}
              {status === 'Critical' && <circle cx={x} cy={z} r="1.2" className="pulse-ring" style={{ fill: statusVar(status) }} />}
              <circle cx={x} cy={z} r={focus ? 1.55 : 1.2} className="stroke-surface transition-[r]" strokeWidth="0.35"
                style={{ fill: status === 'Offline' ? 'var(--surface)' : statusVar(status), stroke: status === 'Offline' ? statusVar(status) : undefined }}
                strokeDasharray={status === 'Unknown' ? '0.5 0.35' : undefined} />
              {showLabel && (
                <text x={x} y={z - 2} textAnchor="middle" className="fill-fg stroke-surface font-mono" fontSize="1.15" fontWeight="500"
                  paintOrder="stroke" strokeWidth="0.5">{shortId(id)}</text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Engineering title block — keeps "illustrative" and "synthetic" in view */}
      <figcaption className="mt-2 grid grid-cols-[1fr_auto_auto] border border-line-strong font-mono text-[10px] leading-tight text-muted">
        <span className="border-r border-line-strong px-2 py-1.5">
          {hovered
            ? <><b className="text-fg">{shortId(hovered.id)}</b> · {hovered.name} · <span style={{ color: statusVar(hovered.status) }}>{STATUS_META[hovered.status].label}</span>{hovered.statusReasons[0] ? ` · ${hovered.statusReasons[0]}` : ''}</>
            : <>TILETWIN DEMONSTRATION FACILITY · GENERAL ARRANGEMENT</>}
        </span>
        <span className="border-r border-line-strong px-2 py-1.5">DWG TT-00 · REV LIVE</span>
        <span className="px-2 py-1.5">N.T.S. · SYNTHETIC</span>
      </figcaption>
    </figure>
  )
}
