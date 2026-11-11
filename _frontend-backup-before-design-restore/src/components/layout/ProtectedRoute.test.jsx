import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuth } from '../../context/useAuth'

vi.mock('../../context/useAuth', () => ({ useAuth: vi.fn() }))

/**
 * Renders a guarded route plus the three destinations it can redirect to, so
 * assertions check where the user actually lands rather than inspecting internals.
 */
function renderGuarded({ role, startAt = '/protected' }) {
  return render(
    <MemoryRouter initialEntries={[startAt]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute role={role}>
              <div>SECRET CONTENT</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>STUDENT LOGIN</div>} />
        <Route path="/admin/login" element={<div>ADMIN LOGIN</div>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('renders children for an authenticated user with the required role', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, role: 'ADMIN' })
    renderGuarded({ role: 'ADMIN' })
    expect(screen.getByText('SECRET CONTENT')).toBeInTheDocument()
  })

  it('sends an unauthenticated visitor to the student login', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, role: null })
    renderGuarded({ role: 'STUDENT' })
    expect(screen.getByText('STUDENT LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument()
  })

  it('sends an unauthenticated visitor to the admin login for admin routes', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, role: null })
    renderGuarded({ role: 'ADMIN' })
    expect(screen.getByText('ADMIN LOGIN')).toBeInTheDocument()
  })

  // The privilege-escalation case: a logged-in student must not reach admin pages.
  it('redirects a STUDENT away from an ADMIN route', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, role: 'STUDENT' })
    renderGuarded({ role: 'ADMIN' })
    expect(screen.getByText('HOME')).toBeInTheDocument()
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument()
  })

  it('redirects an ADMIN away from a STUDENT route', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, role: 'ADMIN' })
    renderGuarded({ role: 'STUDENT' })
    expect(screen.getByText('HOME')).toBeInTheDocument()
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument()
  })

  it('never leaks protected content while unauthenticated, whatever the role', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, role: 'ADMIN' })
    renderGuarded({ role: 'ADMIN' })
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument()
  })
})
