import { KeyRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './auth'

const DEMO_ACCOUNTS = [
  { role: 'Viewer', email: 'dev.viewer@tiletwin.local' },
  { role: 'Inspector', email: 'dev.inspector@tiletwin.local' },
  { role: 'Engineer', email: 'dev.maintenanceengineer@tiletwin.local' },
  { role: 'Admin', email: 'dev.admin@tiletwin.local' },
]

/** Native <dialog> (focus trap, Escape to close) for signing in. */
export function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      setPassword('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="signin-title"
      className="m-auto w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-[var(--shadow-pop)]">
      <form onSubmit={submit} className="space-y-4 p-6" aria-label="Sign in">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent/12 text-accent"><KeyRound className="size-4.5" aria-hidden="true" /></span>
            <div>
              <h2 id="signin-title" className="display text-lg font-semibold">Sign in</h2>
              <p className="text-xs text-muted">Viewing is open; sign in to act on records.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close"><X className="size-4" /></button>
        </div>

        <div>
          <p className="field-label">Demo accounts (DEV ONLY)</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.role} type="button" onClick={() => setEmail(a.email)}
                className={`btn btn-sm ${email === a.email ? 'btn-primary' : 'btn-secondary'}`}>{a.role}</button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="field-label">Email</span>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="field-label">Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </label>
        <p className="text-[11px] text-subtle">Demo password: the <code>DEV_SEED_USER_PASSWORD</code> value in <code>.env</code>.</p>
        {error && <p role="alert" className="text-sm text-crit">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>
    </dialog>
  )
}
