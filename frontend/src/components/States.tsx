import type { ReactNode } from 'react'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-4 text-sm text-slate-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="m-2 rounded border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
      <p className="font-semibold">Could not load data</p>
      <p className="text-red-300/80">{error instanceof Error ? error.message : String(error)}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded bg-red-900/60 px-2 py-1 text-xs hover:bg-red-800">
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="p-4 text-sm text-slate-500">{children}</p>
}

/** Shown wherever synthetic readings/records appear. */
export function DemoBadge() {
  return (
    <span
      title="Synthetic demonstration data — not from a real plant"
      className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 ring-1 ring-amber-500/40"
    >
      DEMO DATA
    </span>
  )
}

export function Panel({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-800 bg-slate-900/70 ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
