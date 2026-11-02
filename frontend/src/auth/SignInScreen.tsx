import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { LogoMark, Wordmark } from '../components/Logo'
import { useAuth } from './auth'

const DEMO_ACCOUNTS = [
  { role: 'Plant Manager', email: 'dev.plantmanager@tiletwin.local' },
  { role: 'Engineer', email: 'dev.maintenanceengineer@tiletwin.local' },
  { role: 'Inspector', email: 'dev.inspector@tiletwin.local' },
  { role: 'Administrator', email: 'dev.administrator@tiletwin.local' },
]

/** Shown instead of the application until someone signs in: every screen shows plant data and no API endpoint is open. */
export function SignInScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-canvas p-4">
      <div className="w-[min(420px,100%)] space-y-5">
        <div className="flex items-center justify-center gap-3"><LogoMark className="size-9" /><Wordmark /></div>
        <form onSubmit={submit} className="card space-y-4 p-6" aria-labelledby="signin-title">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent/12 text-accent"><KeyRound className="size-4.5" aria-hidden="true" /></span>
            <div>
              <h1 id="signin-title" className="display text-lg font-semibold">Sign in</h1>
              <p className="text-xs text-muted">The demonstration plant is visible to signed-in users only.</p>
            </div>
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
          <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  )
}
