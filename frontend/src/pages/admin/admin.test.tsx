import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { mockApi, renderWithProviders, sessionAs } from '../../test-utils'
import OverviewPage from '../OverviewPage'
import type { Overview } from '../OverviewData'
import AdminPage from './AdminPage'

afterEach(() => vi.unstubAllGlobals())

const overview: Overview = {
  dataClassification: 'SYNTHETIC', generatedAt: '2026-10-24T08:00:00Z', statusCounts: {}, openAlerts: { total: 3, critical: 1 }, openHighPriorityObservations: 7,
  latestAnomaly: { machineId: 'MACHINE-HP-002', score: 0.56, threshold: 0.53, timestampUtc: '2026-10-24T08:00:00Z', modelVersion: 'iforest-1.1' },
  config: {
    ai: false, ml: { available: true, message: 'ok', lastCheckedUtc: '2026-10-24T08:00:00Z' },
    tileModel: { configured: false, status: 'MODEL NOT CONFIGURED: TILE_MODEL_PATH is not set' }, knowledgeSearch: 'keyword (embeddings not configured)',
    devUsers: true, simulatorPaused: false, demoData: { seedBatchId: 'demo-v1', anchorUtc: '2026-10-24T07:00:00Z', seededUtc: '2026-10-24T07:00:00Z' },
  },
}

it('shows configuration status but no admin actions to a role without them', async () => {
  mockApi({ '/api/overview': overview, '/api/v1/auth/refresh': sessionAs('PlantManager') })
  renderWithProviders(<AdminPage />)
  expect(await screen.findByText('AI NOT CONFIGURED')).toBeInTheDocument()
  expect(screen.getByText('MODEL NOT CONFIGURED')).toBeInTheDocument()
  expect(await screen.findByText(/Only an Administrator controls the simulator/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reset demo data' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Roles and permissions/)).not.toBeInTheDocument()
})

it('shows the role → permission mapping read-only to an administrator', async () => {
  mockApi({
    '/api/overview': overview, '/api/v1/auth/refresh': sessionAs('Administrator'),
    '/api/admin/simulator': { paused: false, anchorUtc: null, lastReadingUtc: null }, '/api/admin/users': [], '/api/admin/audit': [],
    '/api/admin/roles': [{ role: 'Inspector', permissions: [{ name: 'inspections.perform', capability: 'Perform inspections, record findings, upload evidence', isExtension: false }] }],
  })
  renderWithProviders(<AdminPage />)
  expect(await screen.findByText('inspections.perform')).toBeInTheDocument()
  expect(screen.getByText(/Changing this mapping is a database migration/)).toBeInTheDocument()
})

it('overview shows alert, observation and latest-anomaly indicators', async () => {
  mockApi({ '/api/overview': overview, '/api/machines': [], '/api/v1/auth/refresh': sessionAs('PlantManager') })
  renderWithProviders(<OverviewPage />)
  expect(await screen.findByText('MACHINE-HP-002')).toBeInTheDocument()
  expect(screen.getByText('1 critical · 2 warning')).toBeInTheDocument()
  expect(screen.getByText('7')).toBeInTheDocument()
})
