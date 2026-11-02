import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiSend, getSession, onSessionChange, refreshSession, setSession, type Session } from '../api/client'

export type { Session }

interface AuthValue {
  session: Session | null
  /** False until the first attempt to restore the session from the refresh cookie has finished. */
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** True when the user holds any of the permissions. */
  can: (...permissions: string[]) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)

/** Session state for the UI. The access token stays in memory (api/client); a reload restores it from the refresh cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setState] = useState<Session | null>(getSession)
  const [ready, setReady] = useState(() => getSession() !== null)

  useEffect(() => {
    const off = onSessionChange(setState)
    if (!getSession()) void refreshSession().finally(() => setReady(true))
    return off
  }, [])

  const value: AuthValue = {
    session,
    ready,
    login: async (email, password) => {
      setSession(await apiSend<Session>('POST', '/api/v1/auth/login', { email, password }))
    },
    logout: async () => {
      await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined) // revokes the session server-side
      setSession(null)
    },
    can: (...permissions) => !!session && permissions.some((p) => session.permissions.includes(p)),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
