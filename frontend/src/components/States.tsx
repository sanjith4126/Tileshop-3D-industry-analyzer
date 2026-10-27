import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react'
import { useId, type ReactNode } from 'react'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-accent" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="m-3 flex items-start gap-3 rounded-lg border border-crit/35 bg-crit/8 p-3 text-sm">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-crit" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">Could not load data</p>
        <p className="text-muted">{error instanceof Error ? error.message : String(error)}</p>
      </div>
      {onRetry && <button onClick={onRetry} className="btn btn-secondary btn-sm">Retry</button>}
    </div>
  )
}

export function EmptyState({ children, icon = true }: { children: ReactNode; icon?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-6 text-sm text-subtle">
      {icon && <Inbox aria-hidden="true" className="size-4" />}
      <span>{children}</span>
    </div>
  )
}

/** Shown wherever synthetic readings/records appear. */
export function DemoBadge() {
  return (
    <span
      title="Synthetic demonstration data — not from a real plant"
      className="inline-flex items-center rounded-md bg-warn/12 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-warn ring-1 ring-warn/35 ring-inset"
    >
      DEMO DATA
    </span>
  )
}

/** Card with an optional header row (title + actions). */
export function Panel({ title, actions, children, className = '', icon }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={title ? id : undefined} className={`card overflow-hidden ${className}`}>
      {(title || actions) && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2">
          <h2 id={id} className="flex items-center gap-2 text-[13px] font-semibold text-fg">
            {icon && <span aria-hidden="true" className="text-subtle">{icon}</span>}
            {title}
          </h2>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** Standard page frame: consistent width and spacing. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto space-y-5 px-6 py-6 ${wide ? 'max-w-[1800px]' : 'max-w-[1500px]'}`}>{children}</div>
}

export function PageHeader({ eyebrow, title, description, badges, actions }: {
  eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; badges?: ReactNode; actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="display text-[26px] leading-tight font-semibold text-fg">{title}</h1>
          {badges}
        </div>
        {description && <p className="mt-1.5 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
