import type { MachineStatus } from '../api/types'
import { STATUS_META } from '../lib/status'

export function StatusBadge({ status, size = 'sm' }: { status: MachineStatus; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status]
  const pad = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center gap-1 rounded font-semibold ring-1 ring-inset ${pad} ${m.className}`}>
      <span aria-hidden="true">{m.icon}</span>
      {m.label}
    </span>
  )
}
