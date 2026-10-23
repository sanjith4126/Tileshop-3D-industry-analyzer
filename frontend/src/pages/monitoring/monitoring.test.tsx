import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Alert } from '../../api/types'
import { mockApi, renderWithProviders } from '../../test-utils'
import { AlertsList } from './AlertsList'

const alert: Alert = {
  id: 'a1', machineId: 'MACHINE-HP-002', machineName: 'Hydraulic Press 2', sensorId: 'SENSOR-HP-002-VIB',
  measurement: 'Vibration', unit: 'mm/s', severity: 'Critical', observedValue: 7.2, threshold: 7.1,
  detectedUtc: '2026-10-23T06:00:00Z', status: 'Open', resolvedUtc: null, dataOrigin: 'Synthetic', history: [],
}

const session = (roles: string[]) =>
  JSON.stringify({ token: 't', email: 'x@y', displayName: null, roles, expiresUtc: '2999-01-01T00:00:00Z' })

beforeEach(() => { mockApi({ '/api/alerts': [alert] }) })
afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

it('shows alert value, threshold and severity; no actions when signed out', async () => {
  renderWithProviders(<AlertsList />)
  expect(await screen.findByText('7.2 mm/s (limit 7.1)')).toBeInTheDocument()
  expect(screen.getByText('Critical')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument()
  expect(screen.getByText(/Sign in as Inspector/)).toBeInTheDocument()
})

it('Viewer cannot act; Inspector can acknowledge but not resolve', async () => {
  sessionStorage.setItem('tiletwin.session', session(['Viewer']))
  const { unmount } = renderWithProviders(<AlertsList />)
  await screen.findByText('Vibration')
  expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument()
  unmount()

  sessionStorage.setItem('tiletwin.session', session(['Inspector']))
  renderWithProviders(<AlertsList />)
  expect(await screen.findByRole('button', { name: 'Acknowledge' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument()
})
