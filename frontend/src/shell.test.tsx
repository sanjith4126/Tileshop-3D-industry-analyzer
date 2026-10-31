import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MachineSummary } from './api/types'
import type { Overview } from './pages/OverviewData'
import App from './App'
import { StatusBadge } from './components/StatusBadge'
import { getFocus } from './store/focus'
import { mockApi, renderWithProviders } from './test-utils'

afterEach(() => vi.unstubAllGlobals())

const machine = (id: string, status: MachineSummary['status'], reasons: string[] = []): MachineSummary => ({
  id, name: id, typeId: 'T', typeName: 'Type', zoneId: 'ZONE-PRESS-A', zoneName: 'Pressing', status,
  statusReasons: reasons, maintenanceStatus: 'InService', isFlaggedOffline: false, manufacturer: 'Unknown (demo)',
  model: 'Unknown (demo)', dataOrigin: 'Synthetic', dataClassification: 'SYNTHETIC', lastReadingUtc: null, openAlertCount: 0,
})

const overview: Overview = {
  dataClassification: 'SYNTHETIC', generatedAt: '2026-10-24T08:00:00Z', statusCounts: {}, openAlerts: { total: 3, critical: 1 }, openHighPriorityObservations: 7, latestAnomaly: null,
  config: {
    ai: false, ml: { available: false, message: 'ML service unavailable', lastCheckedUtc: null },
    tileModel: { configured: false, status: 'MODEL NOT CONFIGURED' }, knowledgeSearch: 'keyword (embeddings not configured)',
    devUsers: true, simulatorPaused: false, demoData: null,
  },
}

describe('shell', () => {
  it('shows the synthetic-data banner and all ten navigation entries', () => {
    mockApi({ '/api/machines': [], '/api/overview': overview })
    renderWithProviders(<App />)
    expect(screen.getByRole('note')).toHaveTextContent('DEMONSTRATION FACILITY — SYNTHETIC DEMO DATA')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.querySelectorAll('a')).toHaveLength(10)
  })

  it('status badge shows icon and text, not colour alone', () => {
    const { container } = render(<StatusBadge status="Critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('overview', () => {
  it('counts machines by status and lists machines needing attention', async () => {
    mockApi({
      '/api/machines': [machine('MACHINE-HP-001', 'Normal'), machine('MACHINE-HP-002', 'Critical', ['Vibration 7.85 beyond critical limit']), machine('MACHINE-PUMP-002', 'Unknown')],
      '/api/overview': overview,
    })
    renderWithProviders(<App />)

    const attention = within(await screen.findByRole('region', { name: 'Needs attention' }))
    expect((await attention.findAllByText('MACHINE-HP-002')).length).toBeGreaterThan(0) // fixture name === id
    expect(attention.getByText('Vibration 7.85 beyond critical limit')).toBeInTheDocument()
    expect(attention.queryAllByText('MACHINE-HP-001')).toHaveLength(0)
    expect(screen.getByRole('link', { name: '1 Critical' })).toBeInTheDocument()
    expect(await screen.findByText('AI NOT CONFIGURED')).toBeInTheDocument()
  })

  it('"Show in 3D" requests focus on the machine', async () => {
    mockApi({ '/api/machines': [machine('MACHINE-HP-002', 'Critical')], '/api/overview': overview })
    renderWithProviders(<App />)
    const before = getFocus().seq
    fireEvent.click(await screen.findByRole('button', { name: 'Show in 3D' }))
    expect(getFocus()).toEqual({ entityId: 'MACHINE-HP-002', seq: before + 1 })
  })

  it('shows an error state when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderWithProviders(<App />)
    expect((await screen.findAllByText('Backend API unreachable')).length).toBeGreaterThan(0)
  })
})
