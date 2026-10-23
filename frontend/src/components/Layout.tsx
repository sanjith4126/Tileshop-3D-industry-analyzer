import { NavLink, Outlet } from 'react-router'
import { SignIn } from '../auth/SignIn'

export const NAV = [
  { to: '/', label: 'Overview', icon: '◧' },
  { to: '/twin', label: '3D Digital Twin', icon: '⬢' },
  { to: '/inspection', label: 'Remote Site Inspection', icon: '◎' },
  { to: '/monitoring', label: 'Machine Monitoring', icon: '∿' },
  { to: '/tile-quality', label: 'Tile Quality Inspection', icon: '▦' },
  { to: '/predictive', label: 'Predictive Maintenance', icon: '⚙' },
  { to: '/assistant', label: 'AI Assistant', icon: '✦' },
  { to: '/knowledge', label: 'Knowledge Centre', icon: '☰' },
  { to: '/reports', label: 'Reports', icon: '▤' },
  { to: '/admin', label: 'Administration', icon: '⚑' },
]

export function Layout() {
  return (
    <div className="flex h-screen flex-col">
      <div role="note" className="shrink-0 bg-amber-500 px-4 py-1 text-center text-xs font-bold tracking-wide text-slate-950">
        DEMONSTRATION FACILITY — SYNTHETIC DATA
      </div>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Main" className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-bold tracking-wide text-cyan-300">TileTwin AI</p>
            <p className="text-[11px] text-slate-500">TileTwin Demonstration Facility</p>
          </div>
          <ul className="flex-1 overflow-y-auto py-2">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 text-sm outline-none focus-visible:bg-slate-800 ${
                      isActive ? 'border-l-2 border-cyan-400 bg-slate-900 text-cyan-200' : 'border-l-2 border-transparent text-slate-300 hover:bg-slate-900'
                    }`
                  }
                >
                  <span aria-hidden="true" className="w-4 text-center text-slate-500">{n.icon}</span>
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <SignIn />
          <p className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">Prototype · not security audited</p>
        </nav>
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
