import { fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { InspectionSummary } from '../../api/types'
import { getFocus } from '../../store/focus'
import { mockApi, renderWithProviders } from '../../test-utils'
import { SummaryPanel } from './SummaryPanel'

afterEach(() => vi.unstubAllGlobals())

const summary: InspectionSummary = {
  scope: 'Glazing & Inspection (ZONE-GLAZE-A)', generatedUtc: '2026-10-23T10:00:00Z', total: 6,
  byStatus: { Open: 3, InProgress: 1, Resolved: 1, Closed: 1 }, openByPriority: { Critical: 1, High: 2, Medium: 1, Low: 0 },
  openHighPriority: [], overdueActions: 0, focusEntityIds: ['ZONE-GLAZE-A'], dataClassification: 'SYNTHETIC',
  lines: ['Glazing: 6 observation(s)', '3 open high/critical priority: OBS-ABC123 [Critical] …', 'Source: 6 inspection record(s) of the demonstration plant — SYNTHETIC DEMO DATA.'],
}

it('generates the summary on request and offers Show in 3D for cited entities', async () => {
  const fetch = mockApi({ '/api/inspection/summary': summary })
  renderWithProviders(<SummaryPanel zoneId="ZONE-GLAZE-A" zoneName="Glazing & Inspection" />)
  expect(fetch).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: /Generate inspection summary/ }))

  expect(await screen.findByText(/OBS-ABC123/)).toBeInTheDocument()
  expect(screen.getByText('SYNTHETIC DEMO DATA')).toBeInTheDocument()
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ zoneId: 'ZONE-GLAZE-A' })
  fireEvent.click(screen.getByRole('button', { name: 'Show ZONE-GLAZE-A in 3D' }))
  expect(getFocus().entityId).toBe('ZONE-GLAZE-A')
})
