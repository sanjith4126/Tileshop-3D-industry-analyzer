import { Download } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { apiFetch, downloadFile } from '../api/client'

/** Downloads through the API client, so the request carries the access token (a plain link cannot). */
export function DownloadButton({ path, fileName, className, children }: { path: string; fileName: string; className: string; children: ReactNode }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run() {
    setBusy(true)
    setError(null)
    try { await downloadFile(path, fileName) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <>
      <button type="button" onClick={run} disabled={busy} className={className}>
        <Download className="size-3.5" aria-hidden="true" />{busy ? 'Downloading…' : children}
      </button>
      {error && <span role="alert" className="text-xs text-crit">{error}</span>}
    </>
  )
}

/** An image served by the API, fetched with the access token (an <img src> request cannot carry it). */
export function AuthImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    apiFetch(src)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        objectUrl = URL.createObjectURL(await res.blob())
        if (cancelled) URL.revokeObjectURL(objectUrl)
        else setUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])
  if (failed) return <span role="img" aria-label={`${alt} (could not be loaded)`} className={`${className} flex items-center justify-center bg-raised text-[10px] text-subtle`}>no image</span>
  return url ? <img src={url} alt={alt} className={className} /> : <span aria-hidden="true" className={`${className} block animate-pulse bg-raised`} />
}
