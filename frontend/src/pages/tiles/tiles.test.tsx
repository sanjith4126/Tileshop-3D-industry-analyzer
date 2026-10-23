import { fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { mockApi, renderWithProviders } from '../../test-utils'
import TileQualityPage from './TileQualityPage'

afterEach(() => vi.unstubAllGlobals())

const notConfigured = { mlAvailable: true, configured: false, status: 'MODEL NOT CONFIGURED: TILE_MODEL_PATH is not set', labels: null, modelCard: null }
const samples = [{ id: 'crack', image: '/tile-samples/sample-crack.png', title: 'Hairline crack', documentedResult: { label: 'crack', note: 'Drawn deliberately.' } }]

it('shows MODEL NOT CONFIGURED and history of unclassified uploads', async () => {
  mockApi({
    '/api/tile-inspections/status': notConfigured,
    '/api/tile-inspections': [{ id: '1', originalFileName: 'a.png', sizeBytes: 1, uploadedBy: 'x', uploadedUtc: '2026-10-23T10:00:00Z', outcome: 'ModelNotConfigured', label: null, confidence: null, probabilities: null, modelName: null, modelVersion: null, message: 'MODEL NOT CONFIGURED', imageUrl: '/api/tile-inspections/1/image' }],
    '/tile-samples/samples.json': samples,
  })
  renderWithProviders(<TileQualityPage />)
  expect(await screen.findAllByText('MODEL NOT CONFIGURED')).toHaveLength(2)
})

it('sample mode labels results as not model predictions', async () => {
  mockApi({ '/api/tile-inspections/status': notConfigured, '/api/tile-inspections': [], '/tile-samples/samples.json': samples })
  renderWithProviders(<TileQualityPage />)
  fireEvent.click(screen.getByLabelText('Sample demo mode'))
  expect(await screen.findByText('SAMPLE RESULT — not a model prediction')).toBeInTheDocument()
  expect(await screen.findByText('crack')).toBeInTheDocument()
})
