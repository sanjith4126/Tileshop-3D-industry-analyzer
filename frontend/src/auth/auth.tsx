import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiSend } from '../api/client'

export interface Session {
  token: string
  email: string
  displayName: string | null
  roles: string[]
  expiresUtc: string
}

interface AuthValue {
  session: Session | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasRole: (...roles: string[]) => boolean
}

const KEY = 'tiletwin.session'
const AuthContext = createContext<AuthValue | null>(null)

// Prototype: token kept in sessionStorage (cleared when the tab closes).
function load(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Session | null
    return s && new Date(s.expiresUtc) > new Date() ? s : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(load)

  const value: AuthValue = {
    session,
    login: async (email, password) => {
      const s = await apiSend<Session>('POST', '/api/auth/login', { email, password }, null)
      try { sessionStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage unavailable: session lasts until reload */ }
      setSession(s)
    },
    logout: () => {
      try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
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
