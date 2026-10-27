/** TileTwin mark: a physical tile (outline) and its digital twin (filled, cobalt). */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" className="fill-raised" />
      <rect x="6" y="6" width="13" height="13" rx="2.5" fill="none" className="stroke-muted" strokeWidth="1.8" />
      <rect x="13" y="13" width="13" height="13" rx="2.5" className="fill-accent-strong" />
      <path d="M13 19.5h6v-6.5" fill="none" className="stroke-raised" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <div className="leading-tight">
      <p className="display text-[15px] font-bold tracking-tight text-fg">
        Tile<span className="text-accent">Twin</span>
      </p>
      <p className="text-[11px] text-subtle">Demonstration Facility</p>
    </div>
  )
}
