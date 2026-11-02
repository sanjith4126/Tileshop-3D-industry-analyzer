import { afterEach, expect, it, vi } from 'vitest'
import { apiGet, getSession, refreshSession, setSession, type Session } from './client'

const session = (token: string): Session => ({ token, email: 'x@y', displayName: null, roles: ['PlantManager'], permissions: ['plant.view'], expiresUtc: '2999-01-01T00:00:00Z' })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  setSession(null)
})

it('refreshes once and retries when the access token has expired', async () => {
  setSession(session('old'))
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v1/auth/refresh') return json(session('new'))
    return new Headers(init?.headers).get('Authorization') === 'Bearer new' ? json({ ok: true }) : json({}, 401)
  })
  vi.stubGlobal('fetch', fetch)

  expect(await apiGet('/api/machines')).toEqual({ ok: true })
  expect(getSession()?.token).toBe('new')
  expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/machines', '/api/v1/auth/refresh', '/api/machines'])
})

it('runs one refresh at a time, because each refresh rotates the cookie', async () => {
  const fetch = vi.fn(async () => json(session('fresh')))
  vi.stubGlobal('fetch', fetch)
  const [a, b] = await Promise.all([refreshSession(), refreshSession()])
  expect(a?.token).toBe('fresh')
  expect(b?.token).toBe('fresh')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('signs out when the refresh is refused, but not when the server is unreachable', async () => {
  setSession(session('t'))
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down') }))
  await refreshSession()
  expect(getSession()?.token).toBe('t')

  vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Session ended' }, 401)))
  await refreshSession()
  expect(getSession()).toBeNull()

  setSession(session('t'))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))   // no refresh cookie: nobody signed in
  await refreshSession()
  expect(getSession()).toBeNull()
})

it('never writes the session to browser storage', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json(session('secret'))))
  await refreshSession()
  expect(getSession()?.token).toBe('secret')
  expect(sessionStorage.length + localStorage.length).toBe(0)
})
