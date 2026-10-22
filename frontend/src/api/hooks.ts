import { useQuery } from '@tanstack/react-query'
import { apiGet } from './client'
import type { Health, MachineDetail, MachineSummary, Zone } from './types'

/** Live data polling interval (spec: 5–10 s). */
export const POLL_MS = 7000

export const useHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: ({ signal }) => apiGet<Health>('/api/health', signal), refetchInterval: POLL_MS })

export const useMachines = () =>
  useQuery({
    queryKey: ['machines'],
    queryFn: ({ signal }) => apiGet<MachineSummary[]>('/api/machines', signal),
    refetchInterval: POLL_MS,
  })

export const useMachine = (id: string | null) =>
  useQuery({
    queryKey: ['machine', id],
    queryFn: ({ signal }) => apiGet<MachineDetail>(`/api/machines/${encodeURIComponent(id!)}`, signal),
    enabled: !!id,
    refetchInterval: POLL_MS,
  })

export const useZones = () =>
  useQuery({ queryKey: ['zones'], queryFn: ({ signal }) => apiGet<Zone[]>('/api/zones', signal), refetchInterval: POLL_MS })
