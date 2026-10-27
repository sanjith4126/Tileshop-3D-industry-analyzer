import { Maximize2, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import type { MachineStatus, MachineSummary, Zone } from '../api/types'
import { STATUS_META, statusVar } from '../lib/status'

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

  return (
    <div className="glass pointer-events-auto flex w-64 flex-col gap-3 rounded-xl p-3 text-xs">
      <form onSubmit={submit} className="relative" role="search">
        <label htmlFor="twin-search" className="sr-only">Search machines or zones</label>
        <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-subtle" aria-hidden="true" />
        <input
          id="twin-search"
          list="twin-entities"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setNotFound(false) }}
          placeholder="Find machine or zone…"
          className="input pl-8"
        />
        <datalist id="twin-entities">
          {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          {zones.map((z) => <option key={z.id} value={z.name} />)}
        </datalist>
        <button type="submit" className="sr-only">Find</button>
      </form>
      {notFound && <p role="alert" className="-mt-1 text-warn">No machine or zone matches “{query}”.</p>}

      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={onReset} className="btn btn-secondary btn-sm"><RotateCcw className="size-3.5" aria-hidden="true" />Reset camera</button>
        <button onClick={onFit} className="btn btn-secondary btn-sm"><Maximize2 className="size-3.5" aria-hidden="true" />Fit to factory</button>
      </div>

      <fieldset>
        <legend className="eyebrow mb-1.5">Zones</legend>
        <div className="flex flex-col gap-1">
          {zones.map((z) => (
            <label key={z.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-fg hover:bg-raised">
              <input type="checkbox" checked={!hiddenZones.has(z.id)} onChange={() => onToggleZone(z.id)} className="size-3.5 accent-accent-strong" />
              <span className="flex-1 truncate">{z.name}</span>
              <span className="num text-subtle">{z.machineCount}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export function StatusLegend() {
  return (
    <div className="glass pointer-events-auto rounded-xl px-3 py-2.5 text-xs" aria-label="Status legend">
      <p className="eyebrow mb-1.5">Machine status</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {(Object.keys(STATUS_META) as MachineStatus[]).map((s) => {
          const { Icon, label } = STATUS_META[s]
          return (
            <li key={s} className="flex items-center gap-1.5 text-fg">
              <Icon className="size-3.5" style={{ color: statusVar(s) }} aria-hidden="true" />
              {label}
            </li>
          )
        })}
      </ul>
      <p className="mt-1.5 text-[10px] text-subtle">Geometry is illustrative, not to scale.</p>
    </div>
  )
}
