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
