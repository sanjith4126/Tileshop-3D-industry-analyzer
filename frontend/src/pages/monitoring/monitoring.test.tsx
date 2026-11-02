import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getSession, setSession } from '../../api/client'
import type { Alert, SensorSeries } from '../../api/types'
import { mockApi, renderWithProviders, sessionAs } from '../../test-utils'
import { AlertsList } from './AlertsList'
import { SensorChart } from './SensorChart'

const alert: Alert = {
  id: 'a1', machineId: 'MACHINE-HP-002', machineName: 'Hydraulic Press 2', sensorId: 'SENSOR-HP-002-VIB',
  measurement: 'Vibration', unit: 'mm/s', severity: 'Critical', observedValue: 7.2, threshold: 7.1,
  detectedUtc: '2026-10-23T06:00:00Z', status: 'Open', resolvedUtc: null, dataOrigin: 'Synthetic', dataClassification: 'SYNTHETIC', history: [],
}

beforeEach(() => { mockApi({ '/api/alerts': [alert] }) })
afterEach(() => {
  vi.unstubAllGlobals()
  setSession(null)
})

it('shows alert value, threshold and severity; an inspector sees no actions (Appendix B)', async () => {
  // The session is restored from the refresh cookie, exactly as after a page reload.
  mockApi({ '/api/alerts': [alert], '/api/v1/auth/refresh': sessionAs('Inspector') })
  renderWithProviders(<AlertsList />)
  expect(await screen.findByText('7.2 mm/s (limit 7.1)')).toBeInTheDocument()
  expect(screen.getByText('Critical')).toBeInTheDocument()
  await waitFor(() => expect(getSession()?.roles).toEqual(['Inspector']))
  expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument()
  expect(screen.getByText(/Your role can view alerts/)).toBeInTheDocument()
})

it('a plant manager can acknowledge and resolve', async () => {
  mockApi({ '/api/alerts': [alert], '/api/v1/auth/refresh': sessionAs('PlantManager') })
  renderWithProviders(<AlertsList />)
  expect(await screen.findByRole('button', { name: 'Acknowledge' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
  setSession(null)
})

const at = (m: number) => new Date(Date.UTC(2026, 9, 23, 6, m)).toISOString()
const bucket = (m: number, v: number | null) => ({ t: at(m), avg: v, min: v, max: v, count: v == null ? 0 : 1 })
const flow = (values: (number | null)[]): SensorSeries => ({
  sensorId: 'SENSOR-PUMP-002-FLOW', measurement: 'Flow', unit: 'L/min', warningMin: null, warningMax: 10, criticalMin: null, criticalMax: 12,
  points: values.map((v, i) => bucket(i, v)),
})

it('keeps a gap a gap: empty buckets are counted and listed as no data, never filled', () => {
  renderWithProviders(<SensorChart series={flow([5, 5.5, null, null, 6])} range="1h" />)
  expect(screen.getByRole('img', { name: /3 of 5 buckets have readings, 1 gap\(s\) with no data/ })).toBeInTheDocument()
  expect(screen.getAllByText('no data')).toHaveLength(2)
  expect(screen.getByText('latest avg')).toBeInTheDocument()
  expect(screen.getByText('SYNTHETIC DEMO DATA')).toBeInTheDocument()
})

it('does not present an old reading as the latest when recent buckets are empty', () => {
  renderWithProviders(<SensorChart series={flow([5, 5.5, null, null])} range="1h" />)
  expect(screen.getByText('last reading 06:01 UTC — no recent data')).toBeInTheDocument()
})
