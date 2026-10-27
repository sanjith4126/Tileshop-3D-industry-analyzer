import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { mockApi, renderWithProviders } from '../../test-utils'
import OverviewPage from '../OverviewPage'
import type { Overview } from '../OverviewData'
import AdminPage from './AdminPage'

afterEach(() => vi.unstubAllGlobals())

const overview: Overview = {
  statusCounts: {}, openAlerts: { total: 3, critical: 1 }, openHighPriorityObservations: 7,
  latestAnomaly: { machineId: 'MACHINE-HP-002', score: 0.56, threshold: 0.53, timestampUtc: '2026-10-24T08:00:00Z', modelVersion: 'iforest-1.1' },
  config: {
    ai: false, ml: { available: true, message: 'ok', lastCheckedUtc: '2026-10-24T08:00:00Z' },
    tileModel: { configured: false, status: 'MODEL NOT CONFIGURED: TILE_MODEL_PATH is not set' }, knowledgeSearch: 'keyword (embeddings not configured)',
    devUsers: true, simulatorPaused: false, demoData: { seedBatchId: 'demo-v1', anchorUtc: '2026-10-24T07:00:00Z', seededUtc: '2026-10-24T07:00:00Z' },
  },
}

it('signed-out admin page shows configuration status but no admin actions', async () => {
  mockApi({ '/api/overview': overview, '/api/admin/simulator': { paused: false, anchorUtc: null, lastReadingUtc: null } })
  renderWithProviders(<AdminPage />)
  expect(await screen.findByText('AI NOT CONFIGURED')).toBeInTheDocument()
  expect(screen.getByText('MODEL NOT CONFIGURED')).toBeInTheDocument()
  expect(screen.getByText(/Sign in as Admin/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reset demo data' })).not.toBeInTheDocument()
})

it('overview shows alert, observation and latest-anomaly indicators', async () => {
  mockApi({ '/api/overview': overview, '/api/machines': [] })
  renderWithProviders(<OverviewPage />)
  expect(await screen.findByText('MACHINE-HP-002')).toBeInTheDocument()
  expect(screen.getByText('1 critical · 2 warning')).toBeInTheDocument()
  expect(screen.getByText('7')).toBeInTheDocument()
})
