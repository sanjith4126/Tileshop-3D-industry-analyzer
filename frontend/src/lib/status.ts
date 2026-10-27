import { CircleCheck, CircleHelp, OctagonAlert, PowerOff, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { MachineStatus, SensorState } from '../api/types'
import type { ThemeColors } from '../theme'

/**
 * Colour is never the only indicator: every status has an icon, a text label and a token colour.
 * `fill` names the theme token used for marks (3D beacons, map markers, legend swatches).
 */
export const STATUS_META: Record<MachineStatus, {
  label: string
  Icon: LucideIcon
  fill: 'ok-fill' | 'warn-fill' | 'crit-fill' | 'off-fill' | 'unk-fill'
  text: string
  badge: string
}> = {
  Normal: { label: 'Normal', Icon: CircleCheck, fill: 'ok-fill', text: 'text-ok', badge: 'bg-ok/10 text-ok ring-ok/30' },
  Warning: { label: 'Warning', Icon: TriangleAlert, fill: 'warn-fill', text: 'text-warn', badge: 'bg-warn/12 text-warn ring-warn/35' },
  Critical: { label: 'Critical', Icon: OctagonAlert, fill: 'crit-fill', text: 'text-crit', badge: 'bg-crit/12 text-crit ring-crit/40' },
  Offline: { label: 'Offline', Icon: PowerOff, fill: 'off-fill', text: 'text-off', badge: 'bg-off/12 text-off ring-off/35' },
  Unknown: { label: 'Unknown', Icon: CircleHelp, fill: 'unk-fill', text: 'text-unk', badge: 'bg-unk/12 text-unk ring-unk/35' },
}

/** CSS colour for a status mark in the DOM (follows the active theme). */
export const statusVar = (s: MachineStatus) => `var(--${STATUS_META[s].fill})`

/** Hex colour for a status mark on a canvas (three.js). */
export const statusHex = (s: MachineStatus, c: ThemeColors) => c[STATUS_META[s].fill]

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

/** "12 s ago", "4 min ago", "3 h ago" — for live indicators. */
export function ago(iso: string | number | null | undefined, now = Date.now()) {
  if (iso == null) return '—'
  const s = Math.max(0, Math.round((now - (typeof iso === 'number' ? iso : Date.parse(iso))) / 1000))
  if (s < 60) return `${s} s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

export function formatValue(v: number | null, unit: string) {
  return v == null ? 'no data' : `${Number(v.toFixed(2))} ${unit}`
}

export const PRIORITY_CLASS: Record<string, string> = {
  Critical: 'bg-crit/12 text-crit ring-crit/40',
  High: 'bg-serious/12 text-serious ring-serious/35',
  Medium: 'bg-info/10 text-info ring-info/30',
  Low: 'bg-off/10 text-off ring-off/30',
}
