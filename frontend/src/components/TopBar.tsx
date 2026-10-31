import { Bell, ChevronRight, LogIn, LogOut, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useMachines } from '../api/hooks'
import { useAuth } from '../auth/auth'
import { SignInDialog } from '../auth/SignInDialog'
import { useOverview } from '../pages/OverviewData'
import { useTheme } from '../theme'
import { navFor } from './nav'

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function LiveIndicator() {
  const q = useMachines()
  const now = useNow()
  const secs = q.dataUpdatedAt ? Math.max(0, Math.round((now - q.dataUpdatedAt) / 1000)) : null
  const down = q.isError
  return (
    <span className="hidden items-center gap-2 rounded-full border border-line bg-raised px-2.5 py-1 text-xs text-muted sm:inline-flex" role="status" aria-live="off">
      <span className={`size-2 rounded-full ${down ? 'bg-crit' : 'live-dot bg-ok'}`} aria-hidden="true" />
      {down ? 'Connection lost' : secs == null ? 'Connecting…' : <>Live <span className="num text-subtle">· {secs}s ago</span></>}
    </span>
  )
}

function AlertsButton() {
  const o = useOverview()
  const total = o.data?.openAlerts.total ?? 0
  const critical = o.data?.openAlerts.critical ?? 0
  return (
    <Link to="/monitoring" className="icon-btn relative" aria-label={`${total} open alerts${critical ? `, ${critical} critical` : ''}`}>
      <Bell className="size-4" aria-hidden="true" />
      {total > 0 && (
        <span className={`num absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${critical ? 'bg-crit-fill' : 'bg-warn-fill'}`}>
          {total}
        </span>
      )}
    </Link>
  )
}

function Account({ onSignIn }: { onSignIn: () => void }) {
  const { session, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!session)
    return <button onClick={onSignIn} className="btn btn-secondary btn-sm"><LogIn className="size-3.5" aria-hidden="true" />Sign in</button>

  const initials = (session.displayName ?? session.email).replace(/^DEV ONLY — /, '').slice(0, 2).toUpperCase()
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-left hover:bg-raised">
        <span className="num flex size-7 items-center justify-center rounded-md bg-accent/15 text-[11px] font-semibold text-accent">{initials}</span>
        <span className="hidden text-xs leading-tight md:block">
          <span className="block max-w-40 truncate text-fg">{session.email}</span>
          <span className="block text-subtle">{session.roles.join(', ')}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="glass absolute right-0 z-50 mt-2 w-56 rounded-xl p-1.5">
          <p className="truncate px-2.5 py-1.5 text-xs text-subtle">{session.displayName ?? session.email}</p>
          <button role="menuitem" onClick={() => { logout(); setOpen(false) }} className="btn btn-ghost w-full justify-start">
            <LogOut className="size-4" aria-hidden="true" />Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const { pathname } = useLocation()
  const { theme, toggle } = useTheme()
  const [signIn, setSignIn] = useState(false)
  const nav = navFor(pathname)
  const detail = nav && pathname !== nav.to ? decodeURIComponent(pathname.slice(nav.to.length + 1)) : null

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface/80 px-5 backdrop-blur">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <span className="text-subtle">{nav?.group ?? 'TileTwin'}</span>
        <ChevronRight className="size-3.5 text-subtle" aria-hidden="true" />
        {detail ? (
          <>
            <Link to={nav!.to} className="text-muted hover:text-fg">{nav!.label}</Link>
            <ChevronRight className="size-3.5 text-subtle" aria-hidden="true" />
            <span className="truncate font-mono text-xs text-fg">{detail.length > 24 ? detail.slice(0, 8) + '…' : detail}</span>
          </>
        ) : <span className="truncate font-medium text-fg">{nav?.label ?? 'Not found'}</span>}
      </nav>
      <div className="flex items-center gap-1.5">
        <LiveIndicator />
        <AlertsButton />
        <button onClick={toggle} className="icon-btn" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Porcelain (light) theme' : 'Kiln (dark) theme'}>
          {theme === 'dark' ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
        </button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <Account onSignIn={() => setSignIn(true)} />
      </div>
      <SignInDialog open={signIn} onClose={() => setSignIn(false)} />
    </header>
  )
}
