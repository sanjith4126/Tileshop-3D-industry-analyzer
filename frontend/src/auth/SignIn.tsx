import { useState } from 'react'
import { useAuth } from './auth'

/** Sidebar widget: current user, or an inline sign-in form. */
export function SignIn() {
  const { session, login, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session)
    return (
      <div className="border-t border-slate-800 px-4 py-2 text-xs">
        <p className="truncate text-slate-300" title={session.email}>{session.displayName ?? session.email}</p>
        <p className="text-slate-500">{session.roles.join(', ')}</p>
        <button onClick={logout} className="mt-1 text-cyan-300 hover:underline">Sign out</button>
      </div>
    )

  if (!open)
    return (
      <div className="border-t border-slate-800 px-4 py-2">
        <button onClick={() => setOpen(true)} className="text-xs text-cyan-300 hover:underline">Sign in</button>
        <p className="text-[10px] text-slate-500">Viewing is open; sign in to acknowledge or update.</p>
      </div>
    )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      setPassword('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-1.5 border-t border-slate-800 px-4 py-2 text-xs" aria-label="Sign in">
      <label className="block">
        <span className="text-slate-400">Email</span>
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1" />
      </label>
      <label className="block">
        <span className="text-slate-400">Password</span>
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1" />
      </label>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded bg-cyan-700 px-2 py-1 font-semibold hover:bg-cyan-600 disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">Cancel</button>
      </div>
      <p className="text-[10px] text-slate-500">Dev users: dev.&lt;role&gt;@tiletwin.local (DEV ONLY).</p>
    </form>
  )
}
