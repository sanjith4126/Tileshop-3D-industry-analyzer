import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => vi.unstubAllGlobals())

it('shows the synthetic-data banner and API health', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  render(<App />)
  expect(screen.getByRole('status')).toHaveTextContent('DEMONSTRATION FACILITY — SYNTHETIC DATA')
  expect(await screen.findByText('ok')).toBeInTheDocument()
})

it('reports the API as unavailable when the request fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
  render(<App />)
  expect(await screen.findByText('unavailable')).toBeInTheDocument()
})
