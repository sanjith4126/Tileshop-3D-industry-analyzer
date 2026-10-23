import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { AnomalyScore } from '../../api/types'
import { ScoreCard } from './ScoreCard'

const score: AnomalyScore = {
  score: 0.61, threshold: 0.53, maxFeatureZ: 316, zThreshold: 3.6, isAnomaly: true, modelVersion: 'iforest-1.1',
  timestampUtc: '2026-10-23T10:00:00Z', isFresh: true,
  topDeviations: [{ feature: 'VIB_mean', value: 8.1, zScore: 316 }, { feature: 'TEMP_mean', value: 63, zScore: 40 }],
}

it('shows "ML service unavailable" and no score when the service is down', () => {
  render(<ScoreCard score={null} ml={{ available: false, message: 'ML service unavailable', lastCheckedUtc: '2026-10-23T10:00:00Z' }} />)
  expect(screen.getByRole('alert')).toHaveTextContent('ML service unavailable — no anomaly score.')
  expect(screen.queryByText(/threshold/)).not.toBeInTheDocument()
})

it('explains an anomaly score in plain English with the largest deviation', () => {
  render(<ScoreCard score={score} ml={{ available: true, message: 'ok', lastCheckedUtc: null }} />)
  expect(screen.getByText('0.610')).toBeInTheDocument()
  expect(screen.getByText('! Statistical anomaly')).toBeInTheDocument()
  expect(screen.getByText(/not a diagnosis, and not a prediction/)).toBeInTheDocument()
  expect(screen.getByText('VIB_mean')).toBeInTheDocument()
})
