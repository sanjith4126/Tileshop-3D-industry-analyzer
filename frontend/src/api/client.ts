export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface Session {
  token: string
  email: string
  displayName: string | null
  roles: string[]
  /** Named permissions of the user's roles (section 12.2). The UI uses them only to hide what the API would refuse. */
  permissions: string[]
  expiresUtc: string
}

// The access token lives in memory only, never in storage. The refresh token is an HttpOnly cookie the page cannot read.
let session: Session | null = null
const listeners = new Set<(s: Session | null) => void>()

export const getSession = () => session

export function setSession(s: Session | null) {
  session = s
  listeners.forEach((l) => l(s))
}

export function onSessionChange(listener: (s: Session | null) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

let refreshing: Promise<Session | null> | null = null

/**
 * Exchanges the refresh cookie for a new session. Every refresh rotates the cookie and a second use of the old one
 * ends the session on the server, so refreshes run one at a time: in this tab (one shared promise) and across tabs
 * (Web Locks). An unreachable server keeps the current session; a refused refresh signs out.
 */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= (async () => {
    const run = async (): Promise<Session | null | undefined> => {
      try {
        const res = await fetch('/api/v1/auth/refresh', { method: 'POST', headers: { Accept: 'application/json' } })
        return res.status === 200 ? ((await res.json()) as Session) : null // 204: no session; 401: session ended
      } catch {
        return undefined
      }
    }
    try {
      const s = await (navigator.locks ? navigator.locks.request('tiletwin-refresh', run) : run())
      if (s !== undefined) setSession(s)
      return s ?? session
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** fetch with the access token; on 401 refreshes once and retries (never for the auth endpoints themselves). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const go = () => {
    const headers = new Headers(init.headers)
    if (session) headers.set('Authorization', `Bearer ${session.token}`)
    return fetch(path, { ...init, headers })
  }
  let res = await go()
  if (res.status === 401 && session && !path.startsWith('/api/v1/auth/') && (await refreshSession())) res = await go()
  return res
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await apiFetch(path, { signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Backend API unreachable')
  }
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? 'Not found' : res.status === 401 ? 'Sign in required'
    : res.status === 403 ? 'Your role is not allowed to see this' : `Request failed (${res.status})`)
  return (await res.json()) as T
}

/** Write request as the signed-in user. Throws ApiError with the server's message. */
export async function apiSend<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await apiFetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Backend API unreachable')
  }
  if (!res.ok) {
    const server = ((await res.json().catch(() => null)) as { error?: string; title?: string } | null)?.error
    const msg = res.status === 401 ? server ?? 'Sign in required' : res.status === 403 ? 'Your role is not allowed to do this'
      : server ?? `Request failed (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

/** Downloads a file as the signed-in user (a plain link cannot carry the access token). */
export async function downloadFile(path: string, fileName: string) {
  const res = await apiFetch(path)
  if (!res.ok) throw new ApiError(res.status, res.status === 403 ? 'Your role cannot download this' : `Download failed (${res.status})`)
  const named = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: named ?? fileName })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Multipart upload as the signed-in user; validation messages for the file field come back as the error. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  let res: Response
  try {
    res = await apiFetch(path, { method: 'POST', body: form })
  } catch {
    throw new ApiError(0, 'Backend API unreachable')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { errors?: Record<string, string[]> } | null
    throw new ApiError(res.status, res.status === 401 ? 'Sign in required' : res.status === 403 ? 'Your role cannot upload'
      : body?.errors?.file?.[0] ?? `Upload failed (${res.status})`)
  }
  return (await res.json()) as T
}
