import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { Report } from '../../api/types'
import { ReportBody } from './ReportView'

const report: Report = {
  id: 'r1', status: 'Final', generatedBy: 'dev.viewer@tiletwin.local',
  document: {
    title: 'Maintenance history report', type: 'MaintenanceHistory', generatedUtc: '2026-10-23T10:00:00Z',
    fromUtc: '2020-01-01T00:00:00Z', toUtc: '2020-01-08T00:00:00Z', filters: { Machine: 'MACHINE-HP-002' },
    summary: ['No records for this period.'],
    sections: [{ heading: 'Maintenance records', paragraphs: ['No records for this period.'], table: null }],
    recommendations: ['No gaps between open alerts and recorded maintenance in this period.'],
    dataSource: 'TileTwin database: MaintenanceRecords, Alerts.', containsSyntheticData: true,
  },
}

it('renders an empty-period report with the synthetic data label, filters and data source', () => {
  render(<ReportBody report={report} />)
  expect(screen.getByText(/SYNTHETIC DATA/)).toBeInTheDocument()
  expect(screen.getByText(/Machine: MACHINE-HP-002/)).toBeInTheDocument()
  expect(screen.getAllByText('No records for this period.')).toHaveLength(2)
  expect(screen.getByText(/Data source: TileTwin database/)).toBeInTheDocument()
})
