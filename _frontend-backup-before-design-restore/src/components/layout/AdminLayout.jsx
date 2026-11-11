import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { DashboardSidebar } from './DashboardSidebar'
import { useAuth } from '../../context/useAuth'
import { getCurrentInstitution } from '../../services/institutionService'

/**
 * Admin shell. On mount it re-reads the administrator's institution from the server. That does two
 * things: the dashboard always shows the institution's current registered details, and an
 * institution that has been suspended (or never completed verification) is signed out here instead
 * of seeing a dashboard whose every call would be refused.
 */
export function AdminLayout() {
  const { updateUser, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    getCurrentInstitution()
      .then((institution) => {
        if (!cancelled) updateUser({ institution })
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.status === 401 || err?.status === 403) {
          logout()
          navigate('/admin/login', { replace: true, state: { notice: err.message } })
        }
      })
    return () => {
      cancelled = true
    }
  }, [updateUser, logout, navigate])

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <DashboardSidebar />
      <main className="flex-1 bg-surface-sunken p-4 sm:p-6 md:p-8 lg:p-10">
        <Outlet />
      </main>
    </div>
  )
}
