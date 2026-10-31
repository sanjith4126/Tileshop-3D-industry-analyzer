import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiSend, getSession, onSessionChange, refreshSession, setSession, type Session } from '../api/client'

export type { Session }

interface AuthValue {
  session: Session | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)

/** Session state for the UI. The access token stays in memory (api/client); a reload restores it from the refresh cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setState] = useState<Session | null>(getSession)

  useEffect(() => {
    const off = onSessionChange(setState)
    if (!getSession()) void refreshSession()
    return off
  }, [])

  const value: AuthValue = {
    session,
    login: async (email, password) => {
      setSession(await apiSend<Session>('POST', '/api/v1/auth/login', { email, password }))
    },
    logout: async () => {
      await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined) // revokes the session server-side
      setSession(null)
    },
    hasRole: (...roles) => !!session && roles.some((r) => session.roles.includes(r)),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
