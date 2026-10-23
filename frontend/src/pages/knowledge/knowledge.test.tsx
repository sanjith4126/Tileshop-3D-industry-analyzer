import { fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { mockApi, renderWithProviders } from '../../test-utils'
import KnowledgePage from './KnowledgePage'

afterEach(() => vi.unstubAllGlobals())

it('shows the keyword-search mode and highlights matches with source attribution', async () => {
  mockApi({
    '/api/documents': { searchMode: 'keyword search (embeddings not configured)', documents: [] },
    '/api/documents/search': { mode: 'keyword search (embeddings not configured)', query: 'interlock', hits: [
      { documentId: 'd1', documentTitle: 'Glaze line safety rules (demo)', chunkIndex: 0, snippet: 'door «interlocks» must never', score: 0.1 },
    ] },
  })
  renderWithProviders(<KnowledgePage />)
  expect(await screen.findByText('keyword search (embeddings not configured)')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search documents'), { target: { value: 'interlock' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByText('Glaze line safety rules (demo)')).toBeInTheDocument()
  expect(screen.getByText('interlocks').tagName).toBe('MARK')
})
