import { ChevronsLeft, ChevronsRight, Lock, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/auth'
import { SignInScreen } from '../auth/SignInScreen'
import { LogoMark, Wordmark } from './Logo'
import { NAV, NAV_GROUPS, navFor } from './nav'
import { EmptyState, Loading } from './States'
import { TopBar } from './TopBar'

export { NAV } from './nav'

const COLLAPSE_KEY = 'tiletwin.sidebar'

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

/** The synthetic-data banner, shown on every screen including sign-in. */
function Banner() {
  return (
    <div role="note" className="hazard flex h-7 shrink-0 items-center justify-center">
      <span className="rounded-sm bg-[#1b1406] px-2.5 py-0.5 text-[11px] font-bold tracking-[0.16em] text-[#f2b544]">
        DEMONSTRATION FACILITY — SYNTHETIC DEMO DATA
      </span>
    </div>
  )
}

/** Signed-in users see the pages their permissions allow; everyone else sees the sign-in screen. */
export function Layout() {
  const { session, ready, can } = useAuth()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* per-session only */ }
      return !c
    })
  }

  if (!session)
    return (
      <div className="flex h-screen flex-col">
        <Banner />
        {ready ? <SignInScreen /> : <Loading label="Restoring your session…" />}
      </div>
    )

  const visible = NAV.filter((n) => can(...n.anyOf))
  const page = navFor(pathname)
  return (
    <div className="flex h-screen flex-col">
      <Banner />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Main" className={`flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ${collapsed ? 'w-[68px]' : 'w-[248px]'}`}>
          <div className={`flex h-14 items-center gap-3 border-b border-line ${collapsed ? 'justify-center' : 'px-4'}`}>
            <LogoMark className="size-8 shrink-0" />
            {!collapsed && <Wordmark />}
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto py-4">
            {NAV_GROUPS.filter((group) => visible.some((n) => n.group === group)).map((group) => (
              <div key={group}>
                {!collapsed && <p className="eyebrow mb-1.5 px-5">{group}</p>}
                <ul className="space-y-0.5 px-2.5">
                  {visible.filter((n) => n.group === group).map(({ to, label, Icon }) => (
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
            {page && !can(...page.anyOf) ? (
              <div className="p-8">
                <EmptyState icon={false}><Lock className="mr-1 inline size-4" aria-hidden="true" />{page.label} is not available for your role.</EmptyState>
              </div>
            ) : <Outlet />}
          </main>
        </div>
      </div>
    </div>
  )
}
