import { ChevronsLeft, ChevronsRight, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { LogoMark, Wordmark } from './Logo'
import { NAV, NAV_GROUPS } from './nav'
import { TopBar } from './TopBar'

export { NAV } from './nav'

const COLLAPSE_KEY = 'tiletwin.sidebar'

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* per-session only */ }
      return !c
    })
  }

  return (
    <div className="flex h-screen flex-col">
      <div role="note" className="hazard flex h-7 shrink-0 items-center justify-center">
        <span className="rounded-sm bg-[#1b1406] px-2.5 py-0.5 text-[11px] font-bold tracking-[0.16em] text-[#f2b544]">
          DEMONSTRATION FACILITY — SYNTHETIC DEMO DATA
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Main" className={`flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ${collapsed ? 'w-[68px]' : 'w-[248px]'}`}>
          <div className={`flex h-14 items-center gap-3 border-b border-line ${collapsed ? 'justify-center' : 'px-4'}`}>
            <LogoMark className="size-8 shrink-0" />
            {!collapsed && <Wordmark />}
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto py-4">
            {NAV_GROUPS.map((group) => (
              <div key={group}>
                {!collapsed && <p className="eyebrow mb-1.5 px-5">{group}</p>}
                <ul className="space-y-0.5 px-2.5">
                  {NAV.filter((n) => n.group === group).map(({ to, label, Icon }) => (
                    <li key={to}>
                      <NavLink to={to} end={to === '/'} title={collapsed ? label : undefined}
                        className={({ isActive }) =>
                          `group relative flex h-9 items-center gap-3 rounded-lg text-[13px] transition-colors ${collapsed ? 'justify-center' : 'px-2.5'} ${
                            isActive ? 'bg-accent/10 font-medium text-fg' : 'text-muted hover:bg-raised hover:text-fg'
                          }`}>
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="absolute top-2 bottom-2 -left-2.5 w-[3px] rounded-r-full bg-accent" aria-hidden="true" />}
                            <Icon className={`size-[18px] shrink-0 ${isActive ? 'text-accent' : 'text-subtle group-hover:text-muted'}`} strokeWidth={1.75} aria-hidden="true" />
                            {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-line p-2.5">
            {!collapsed && (
              <p className="flex items-center gap-2 px-2.5 text-[11px] text-subtle">
                <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />Prototype · not security audited
              </p>
            )}
            <button onClick={toggle} className={`btn btn-ghost btn-sm w-full ${collapsed ? '' : 'justify-start'}`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? <ChevronsRight className="size-4" aria-hidden="true" /> : <><ChevronsLeft className="size-4" aria-hidden="true" />Collapse</>}
            </button>
          </div>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
