import { Activity, BookOpen, Box, FileText, Gauge, Grid3x3, LayoutDashboard, ScanSearch, Settings, Sparkles, type LucideIcon } from 'lucide-react'

export interface NavItem { to: string; label: string; group: string; Icon: LucideIcon }

/** Navigation in the order given by the spec, grouped for scanning. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', group: 'Operations', Icon: LayoutDashboard },
  { to: '/twin', label: '3D Digital Twin', group: 'Operations', Icon: Box },
  { to: '/inspection', label: 'Remote Site Inspection', group: 'Operations', Icon: ScanSearch },
  { to: '/monitoring', label: 'Machine Monitoring', group: 'Operations', Icon: Activity },
  { to: '/tile-quality', label: 'Tile Quality Inspection', group: 'Quality & reliability', Icon: Grid3x3 },
  { to: '/predictive', label: 'Predictive Maintenance', group: 'Quality & reliability', Icon: Gauge },
  { to: '/assistant', label: 'AI Assistant', group: 'Intelligence', Icon: Sparkles },
  { to: '/knowledge', label: 'Knowledge Centre', group: 'Intelligence', Icon: BookOpen },
  { to: '/reports', label: 'Reports', group: 'Intelligence', Icon: FileText },
  { to: '/admin', label: 'Administration', group: 'System', Icon: Settings },
]

export const NAV_GROUPS = [...new Set(NAV.map((n) => n.group))]

export function navFor(pathname: string): NavItem | undefined {
  return NAV.filter((n) => n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(n.to + '/'))[0]
}
