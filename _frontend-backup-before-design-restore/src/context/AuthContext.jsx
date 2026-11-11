import { useCallback, useMemo, useState } from 'react'
import { AuthContext } from './auth-context'

const STORAGE_KEY = 'kredent_auth'

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persist(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable (private mode) — the session simply won't survive a reload
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth)

  const login = useCallback((authResponse) => {
    // authResponse: { token, role, id, fullName, email, institution? }
    // `institution` is present for college administrators only — { id, institutionId, name, state,
    // district, walletAddress } — and drives the dashboard's institution name and details.
    persist(authResponse)
    setAuth(authResponse)
  }, [])

  const logout = useCallback(() => {
    persist(null)
    setAuth(null)
  }, [])

  /** Merge fresh server-side fields (e.g. the institution) into the stored session. */
  const updateUser = useCallback((patch) => {
    setAuth((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      token: auth?.token ?? null,
      role: auth?.role ?? null,
      user: auth,
      institution: auth?.institution ?? null,
      isAuthenticated: Boolean(auth?.token),
      login,
      logout,
      updateUser,
    }),
    [auth, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
