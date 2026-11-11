import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

export function ProtectedRoute({ role, children }) {
  const { isAuthenticated, role: currentRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const redirectTo = role === 'ADMIN' ? '/admin/login' : '/login'
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }

  if (role && currentRole !== role) {
    return <Navigate to="/" replace />
  }

  return children
}
