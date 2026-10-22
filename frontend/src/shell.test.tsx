import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Health, MachineSummary } from './api/types'
import App from './App'
import { StatusBadge } from './components/StatusBadge'
import { getFocus } from './store/focus'
import { mockApi, renderWithProviders } from './test-utils'

afterEach(() => vi.unstubAllGlobals())

const machine = (id: string, status: MachineSummary['status'], reasons: string[] = []): MachineSummary => ({
  id, name: id, typeId: 'T', typeName: 'Type', zoneId: 'ZONE-PRESS-A', zoneName: 'Pressing', status,
  statusReasons: reasons, maintenanceStatus: 'InService', isFlaggedOffline: false, manufacturer: 'Unknown (demo)',
  model: 'Unknown (demo)', dataOrigin: 'Synthetic', lastReadingUtc: null,
})

const health: Health = {
  status: 'ok', database: 'ok', demoData: null, timestampUtc: '',
  features: { ai: false, embeddings: false, mlServiceUrl: 'http://localhost:8001', devUsers: true },
}

describe('shell', () => {
  it('shows the synthetic-data banner and all ten navigation entries', () => {
    mockApi({ '/api/machines': [], '/api/health': health })
    renderWithProviders(<App />)
    expect(screen.getByRole('note')).toHaveTextContent('DEMONSTRATION FACILITY — SYNTHETIC DATA')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.querySelectorAll('a')).toHaveLength(10)
  })

  it('status badge shows icon and text, not colour alone', () => {
    render(<StatusBadge status="Critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('‼')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('overview', () => {
  it('counts machines by status and lists machines needing attention', async () => {
    mockApi({
      '/api/machines': [machine('MACHINE-HP-001', 'Normal'), machine('MACHINE-HP-002', 'Critical', ['Vibration 7.85 beyond critical limit']), machine('MACHINE-PUMP-002', 'Unknown')],
      '/api/health': health,
    })
    renderWithProviders(<App />)

    expect(await screen.findByText('MACHINE-HP-002')).toBeInTheDocument()
    expect(screen.getByText('Vibration 7.85 beyond critical limit')).toBeInTheDocument()
    expect(screen.queryByText('MACHINE-HP-001')).not.toBeInTheDocument()
    expect(await screen.findByText('AI NOT CONFIGURED')).toBeInTheDocument()
  })

  it('"Show in 3D" requests focus on the machine', async () => {
    mockApi({ '/api/machines': [machine('MACHINE-HP-002', 'Critical')], '/api/health': health })
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
