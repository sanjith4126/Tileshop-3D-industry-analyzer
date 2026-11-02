import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Session } from './api/client'
import { AuthProvider } from './auth/auth'

const ALL = ['plant.view', 'machines.view', 'alerts.view', 'inspections.view', 'reports.generate', 'assistant.use', 'knowledge.view', 'tiles.view']
/** Permissions per role as seeded from Appendix B (backend `Permissions.All`; PermissionMatrixTests pin that mapping). */
export const ROLE_PERMISSIONS = {
  Administrator: [...ALL, 'plant.manage', 'alerts.acknowledge', 'anomalies.view', 'maintenance.view', 'maintenance.manage', 'inspections.manage',
    'inspections.perform', 'corrective-actions.create', 'corrective-actions.work', 'corrective-actions.verify', 'users.manage', 'simulator.control',
    'audit.view', 'knowledge.manage', 'tiles.inspect'],
  PlantManager: [...ALL, 'alerts.acknowledge', 'anomalies.view', 'maintenance.view', 'inspections.manage', 'corrective-actions.create',
    'corrective-actions.verify', 'knowledge.manage'],
  MaintenanceEngineer: [...ALL, 'alerts.acknowledge', 'anomalies.view', 'maintenance.view', 'maintenance.manage', 'corrective-actions.work',
    'knowledge.manage', 'tiles.inspect'],
  Inspector: [...ALL, 'inspections.perform', 'corrective-actions.create', 'corrective-actions.verify', 'tiles.inspect'],
}

/** A session as the refresh endpoint returns it; mock '/api/v1/auth/refresh' with it to render as a signed-in user. */
export const sessionAs = (role: keyof typeof ROLE_PERMISSIONS): Session => ({
  token: 't', email: `dev.${role.toLowerCase()}@tiletwin.local`, displayName: null, roles: [role],
  permissions: ROLE_PERMISSIONS[role], expiresUtc: '2999-01-01T00:00:00Z',
})

export function renderWithProviders(ui: ReactNode, route = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

/** Stub fetch with a map of path → JSON body (anything else → 404). */
export function mockApi(routes: Record<string, unknown>) {
  const fn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = typeof input === 'string' ? input : input.toString()
    const key = Object.keys(routes).find((k) => path === k || path.startsWith(k + '?'))
    if (!key) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
