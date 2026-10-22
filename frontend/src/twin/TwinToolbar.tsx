import { useState } from 'react'
import type { MachineStatus, MachineSummary, Zone } from '../api/types'
import { STATUS_META } from '../lib/status'

interface Props {
  machines: MachineSummary[]
  zones: Zone[]
  hiddenZones: Set<string>
  onToggleZone: (id: string) => void
  onSearch: (entityId: string) => void
  onReset: () => void
  onFit: () => void
}

export function TwinToolbar({ machines, zones, hiddenZones, onToggleZone, onSearch, onReset, onFit }: Props) {
  const [query, setQuery] = useState('')
  const [notFound, setNotFound] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return
    const hit = machines.find((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      ?? zones.find((z) => z.id.toLowerCase().includes(q) || z.name.toLowerCase().includes(q))
    setNotFound(!hit)
    if (hit) onSearch(hit.id)
  }

  const btn = 'rounded bg-slate-800 px-2.5 py-1 text-xs hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-cyan-400'

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/90 p-2 text-xs shadow-lg">
      <form onSubmit={submit} className="flex gap-1" role="search">
        <label htmlFor="twin-search" className="sr-only">Search machines or zones</label>
        <input
          id="twin-search"
          list="twin-entities"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setNotFound(false) }}
          placeholder="Search e.g. HP-002, Glazing…"
          className="w-52 rounded border border-slate-700 bg-slate-900 px-2 py-1 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <datalist id="twin-entities">
          {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          {zones.map((z) => <option key={z.id} value={z.name} />)}
        </datalist>
        <button type="submit" className={btn}>Find</button>
      </form>
      {notFound && <p role="alert" className="text-amber-300">No machine or zone matches “{query}”.</p>}

      <div className="flex gap-1">
        <button onClick={onReset} className={btn}>Reset camera</button>
        <button onClick={onFit} className={btn}>Fit to factory</button>
      </div>

      <fieldset>
        <legend className="mb-1 text-[10px] tracking-wider text-slate-500 uppercase">Zones</legend>
        <div className="flex flex-col gap-0.5">
          {zones.map((z) => (
            <label key={z.id} className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={!hiddenZones.has(z.id)} onChange={() => onToggleZone(z.id)} className="accent-cyan-500" />
              {z.name}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export function StatusLegend() {
  return (
    <div className="pointer-events-auto rounded-lg border border-slate-800 bg-slate-950/90 p-2 text-xs" aria-label="Status legend">
      <p className="mb-1 text-[10px] tracking-wider text-slate-500 uppercase">Machine status</p>
      <ul className="space-y-0.5">
        {(Object.keys(STATUS_META) as MachineStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].color }} aria-hidden="true" />
            <span aria-hidden="true" className="w-3 text-center">{STATUS_META[s].icon}</span>
            {STATUS_META[s].label}
          </li>
        ))}
      </ul>
      <p className="mt-1 max-w-44 text-[10px] text-slate-500">Geometry is illustrative, not to scale.</p>
    </div>
  )
}
