import { useQuery } from '@tanstack/react-query'
import { apiGet } from './client'
import type { Alert, Health, MachineDetail, MachineSummary, ReadingsRange, ReadingsResponse, Zone } from './types'

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

export const useAlerts = (machineId?: string, status?: 'Open' | 'Acknowledged' | 'Resolved') =>
  useQuery({
    queryKey: ['alerts', machineId ?? null, status ?? 'active'],
    queryFn: ({ signal }) => {
      const p = new URLSearchParams({ limit: '100' })
      if (machineId) p.set('machineId', machineId)
      if (status) p.set('status', status)
      return apiGet<Alert[]>(`/api/alerts?${p}`, signal)
    },
    refetchInterval: POLL_MS,
  })

export const useReadings = (machineId: string, range: ReadingsRange) =>
  useQuery({
    queryKey: ['readings', machineId, range],
    queryFn: ({ signal }) => apiGet<ReadingsResponse>(`/api/machines/${encodeURIComponent(machineId)}/readings?range=${range}`, signal),
    refetchInterval: range === '1h' ? POLL_MS : 30_000,
  })
