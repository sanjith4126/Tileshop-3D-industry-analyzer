import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { mockApi, renderWithProviders } from '../../test-utils'
import AssistantPage from './AssistantPage'

afterEach(() => vi.unstubAllGlobals())

it('shows AI NOT CONFIGURED and no chat when the backend has no key', async () => {
  mockApi({ '/api/assistant/status': { configured: false, model: null, message: 'AI NOT CONFIGURED — set ANTHROPIC_API_KEY and LLM__Model' } })
  renderWithProviders(<AssistantPage />)
  expect(await screen.findByText('AI NOT CONFIGURED')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})
