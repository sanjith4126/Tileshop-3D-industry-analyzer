import type { MachineStatus } from '../api/types'
import { STATUS_META } from '../lib/status'

export function StatusBadge({ status, size = 'sm' }: { status: MachineStatus; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status]
  const cls = size === 'md' ? 'gap-1.5 px-2.5 py-1 text-[13px]' : 'gap-1 px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ring-1 ring-inset ${cls} ${m.badge}`}>
      <m.Icon aria-hidden="true" className={size === 'md' ? 'size-4' : 'size-3.5'} strokeWidth={2} />
      {m.label}
    </span>
  )
}
