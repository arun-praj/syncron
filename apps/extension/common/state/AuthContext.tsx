import { createContext, useContext, useState, type ReactNode } from "react"

import { mockCurrentUser, type MockUser } from "~common/lib/mock-data"

interface AuthContextValue {
  isAuthed: boolean
  user: MockUser | null
  login: () => void
  signup: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Mock auth only — flips local state, never calls the real backend. Wiring
// this up to the Docker backend's auth endpoints is a follow-up pass.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false)

  const value: AuthContextValue = {
    isAuthed,
    user: isAuthed ? mockCurrentUser : null,
    login: () => setIsAuthed(true),
    signup: () => setIsAuthed(true),
    logout: () => setIsAuthed(false)
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
