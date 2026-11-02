import { Activity, BookOpen, Box, FileText, Gauge, Grid3x3, LayoutDashboard, ScanSearch, Settings, Sparkles, type LucideIcon } from 'lucide-react'

/** `anyOf`: the page is shown to users holding any of these permissions (the API enforces them regardless). */
export interface NavItem { to: string; label: string; group: string; Icon: LucideIcon; anyOf: string[] }

/** Navigation in the order given by the spec, grouped for scanning. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', group: 'Operations', Icon: LayoutDashboard, anyOf: ['plant.view'] },
  { to: '/twin', label: '3D Digital Twin', group: 'Operations', Icon: Box, anyOf: ['plant.view'] },
  { to: '/inspection', label: 'Remote Site Inspection', group: 'Operations', Icon: ScanSearch, anyOf: ['inspections.view'] },
  { to: '/monitoring', label: 'Machine Monitoring', group: 'Operations', Icon: Activity, anyOf: ['plant.view'] },
  { to: '/tile-quality', label: 'Tile Quality Inspection', group: 'Quality & reliability', Icon: Grid3x3, anyOf: ['tiles.view'] },
  { to: '/predictive', label: 'Predictive Maintenance', group: 'Quality & reliability', Icon: Gauge, anyOf: ['anomalies.view'] },
  { to: '/assistant', label: 'AI Assistant', group: 'Intelligence', Icon: Sparkles, anyOf: ['assistant.use'] },
  { to: '/knowledge', label: 'Knowledge Centre', group: 'Intelligence', Icon: BookOpen, anyOf: ['knowledge.view'] },
  { to: '/reports', label: 'Reports', group: 'Intelligence', Icon: FileText, anyOf: ['reports.generate'] },
  { to: '/admin', label: 'Administration', group: 'System', Icon: Settings, anyOf: ['users.manage', 'simulator.control', 'audit.view'] },
]

export const NAV_GROUPS = [...new Set(NAV.map((n) => n.group))]

export function navFor(pathname: string): NavItem | undefined {
  return NAV.filter((n) => n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(n.to + '/'))[0]
}
