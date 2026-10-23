export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Backend API unreachable')
  }
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? 'Not found' : `Request failed (${res.status})`)
  return (await res.json()) as T
}

/** Write request with the signed-in user's bearer token. Throws ApiError with the server's message. */
export async function apiSend<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body: unknown, token: string | null): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Backend API unreachable')
  }
  if (!res.ok) {
    const msg = res.status === 401 ? 'Sign in required' : res.status === 403 ? 'Your role is not allowed to do this'
      : ((await res.json().catch(() => null)) as { error?: string; title?: string } | null)?.error ?? `Request failed (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
