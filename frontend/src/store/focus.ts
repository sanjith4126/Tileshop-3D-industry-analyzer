import { useSyncExternalStore } from 'react'

/**
 * Shared "show in 3D" store. Any module calls focusEntity(entityId) (machine or zone ID returned by
 * the backend); the 3D twin highlights it. `seq` changes on every request so re-focusing the same
 * entity still triggers a camera move.
 */
export interface FocusRequest {
  entityId: string | null
  seq: number
}

let state: FocusRequest = { entityId: null, seq: 0 }
const listeners = new Set<() => void>()

export function focusEntity(entityId: string | null) {
  state = { entityId, seq: state.seq + 1 }
  listeners.forEach((l) => l())
}

export const getFocus = () => state

export function useFocus(): FocusRequest {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getFocus,
  )
}
