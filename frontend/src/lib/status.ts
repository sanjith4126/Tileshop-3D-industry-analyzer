import type { MachineStatus, SensorState } from '../api/types'

/** Colour is never the only indicator: every status also has an icon glyph and a text label. */
export const STATUS_META: Record<MachineStatus, { color: string; icon: string; label: string; className: string }> = {
  Normal: { color: '#22c55e', icon: '✓', label: 'Normal', className: 'bg-green-500/15 text-green-300 ring-green-500/40' },
  Warning: { color: '#f59e0b', icon: '!', label: 'Warning', className: 'bg-amber-500/15 text-amber-300 ring-amber-500/40' },
  Critical: { color: '#ef4444', icon: '‼', label: 'Critical', className: 'bg-red-500/20 text-red-300 ring-red-500/50' },
  Offline: { color: '#64748b', icon: '⏻', label: 'Offline', className: 'bg-slate-500/20 text-slate-300 ring-slate-500/40' },
  Unknown: { color: '#a855f7', icon: '?', label: 'Unknown', className: 'bg-purple-500/15 text-purple-300 ring-purple-500/40' },
}

export const STATUS_ORDER: MachineStatus[] = ['Critical', 'Warning', 'Unknown', 'Offline', 'Normal']

export const SENSOR_STATE_TO_STATUS: Record<SensorState, MachineStatus> = {
  Normal: 'Normal',
  Warning: 'Warning',
  Critical: 'Critical',
  Missing: 'Unknown',
}

export const shortId = (id: string) => id.replace(/^(MACHINE|ZONE|SENSOR)-/, '')

export function formatUtc(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

export function formatValue(v: number | null, unit: string) {
  return v == null ? 'no data' : `${Number(v.toFixed(2))} ${unit}`
}
