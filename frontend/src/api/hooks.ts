import { useQuery } from '@tanstack/react-query'
import { apiGet } from './client'
import type { Alert, Health, Predictive, PredictiveListItem, InspectionZone, ObservationDetail, ObservationSummary, MachineDetail, MachineSummary, ReadingsRange, ReadingsResponse, Zone } from './types'

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

export const useInspectionZones = () =>
  useQuery({ queryKey: ['inspection-zones'], queryFn: ({ signal }) => apiGet<InspectionZone[]>('/api/inspection/zones', signal), refetchInterval: 30_000 })

export const useObservations = (filters: Record<string, string>) =>
  useQuery({
    queryKey: ['observations', filters],
    queryFn: ({ signal }) => {
      const p = new URLSearchParams(Object.entries(filters).filter(([, v]) => v))
      return apiGet<ObservationSummary[]>(`/api/observations?${p}`, signal)
    },
  })

export const useObservation = (id: string) =>
  useQuery({ queryKey: ['observation', id], queryFn: ({ signal }) => apiGet<ObservationDetail>(`/api/observations/${encodeURIComponent(id)}`, signal) })

export const usePredictiveList = () =>
  useQuery({ queryKey: ['predictive'], queryFn: ({ signal }) => apiGet<PredictiveListItem[]>('/api/predictive', signal), refetchInterval: 30_000 })

export const usePredictive = (machineId: string | null) =>
  useQuery({
    queryKey: ['predictive', machineId],
    queryFn: ({ signal }) => apiGet<Predictive>(`/api/predictive/${encodeURIComponent(machineId!)}`, signal),
    enabled: !!machineId,
    refetchInterval: 30_000,
  })
