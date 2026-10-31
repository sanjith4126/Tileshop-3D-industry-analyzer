import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { mockApi, renderWithProviders } from '../../test-utils'
import type { Overview } from '../OverviewData'
import OverviewPage from '../OverviewPage'

afterEach(() => vi.unstubAllGlobals())

const days = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']
const overview: Overview = {
  dataClassification: 'SYNTHETIC', generatedAt: '2026-10-31T08:00:00Z',
  statusCounts: { Normal: 13, Warning: 0, Critical: 1, Offline: 1, Unknown: 1 }, openAlerts: { total: 0, critical: 0 },
  openHighPriorityObservations: 0, latestAnomaly: null,
  production: {
    fromUtc: '2026-10-25T00:00:00Z', toUtc: '2026-10-31T08:00:00Z', units: 0, rejected: 0, ratePercent: null,
    days: days.map((day) => ({ day, units: 0, rejected: 0, ratePercent: null })),
  },
  config: {
    ai: false, ml: { available: false, message: 'ML service unavailable', lastCheckedUtc: null },
    tileModel: { configured: false, status: 'MODEL NOT CONFIGURED' }, knowledgeSearch: 'keyword (embeddings not configured)',
    devUsers: false, simulatorPaused: false, demoData: null,
  },
}

it('shows no reject rate, not 0 %, when there are no production records', async () => {
  mockApi({ '/api/machines': [], '/api/overview': overview, '/api/alerts': [] })
  renderWithProviders(<OverviewPage />)
  expect(await screen.findByText('No production records in the last 7 days')).toBeInTheDocument()
  expect(screen.getByText('No data')).toBeInTheDocument()
  expect(screen.queryByText(/0\.00/)).not.toBeInTheDocument()
})
