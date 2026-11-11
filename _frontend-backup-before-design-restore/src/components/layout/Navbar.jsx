import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { KredentLogo } from '../brand/KredentLogo'
import { useAuth } from '../../context/useAuth'

const navItems = [
  { label: 'Home', to: '/', end: true },
  { label: 'Verify Certificate', to: '/verify' },
  { label: 'For Institutions', to: '/admin/login' },
  { label: 'Student Portal', to: '/login' },
]

const demoLink = { label: 'Demo Registry', to: '/registry' }

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

const desktopLinkClass = ({ isActive }) =>
  `rounded-lg px-3.5 py-2 text-caption font-semibold transition ${
    isActive ? 'bg-brand-cream text-brand-primary' : 'text-brand-ink/75 hover:bg-surface-sunken hover:text-brand-primary'
  }`

/** Public site header. Neutral Kredent branding only — never tied to a single institution. */
export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const menuButtonRef = useRef(null)
  const drawerRef = useRef(null)
  const { isAuthenticated, role, logout } = useAuth()

  const dashboardLink = isAuthenticated
    ? { label: 'My Dashboard', to: role === 'ADMIN' ? '/admin' : '/student' }
    : null

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('button[aria-label="Close menu"]')?.focus()
    const trigger = menuButtonRef.current

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [isMenuOpen])

  return (
    <header
      className={`sticky top-0 z-50 border-b border-surface-line bg-white/95 backdrop-blur transition-shadow duration-300 ${
        isScrolled ? 'shadow-[0_2px_20px_rgba(49,46,129,0.10)]' : ''
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 lg:h-[4.5rem] lg:px-10">
        <NavLink to="/" aria-label="Kredent home" className="min-w-0">
          <KredentLogo />
        </NavLink>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={desktopLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to={demoLink.to} className={desktopLinkClass}>
            {demoLink.label}
          </NavLink>
          {dashboardLink && (
            <>
              <NavLink
                to={dashboardLink.to}
                className="ml-2 rounded-lg bg-brand-primary px-4 py-2 text-caption font-semibold text-white transition hover:bg-brand-primary-deep"
              >
                {dashboardLink.label}
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3.5 py-2 text-caption font-semibold text-brand-ink/75 transition hover:bg-surface-sunken hover:text-brand-primary"
              >
                Sign out
              </button>
            </>
          )}
        </nav>

        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
          className="rounded-lg p-2 text-brand-primary transition hover:bg-surface-sunken lg:hidden"
        >
          <MenuIcon />
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-brand-primary-deep/50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMenuOpen(false)
            }}
          >
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 260 }}
              className="fixed right-0 top-0 flex h-full w-[19rem] max-w-[85vw] flex-col bg-white px-5 py-5 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <KredentLogo markClassName="h-8 w-8" />
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg p-2 text-brand-primary transition hover:bg-surface-sunken"
                >
                  <CloseIcon />
                </button>
              </div>

              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {[...navItems, demoLink, ...(dashboardLink ? [dashboardLink] : [])].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-lg px-4 py-3 text-body font-semibold transition ${
                        isActive ? 'bg-brand-cream text-brand-primary' : 'text-brand-ink hover:bg-surface-sunken'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      logout()
                    }}
                    className="rounded-lg px-4 py-3 text-left text-body font-semibold text-brand-ink transition hover:bg-surface-sunken"
                  >
                    Sign out
                  </button>
                )}
              </nav>

              <p className="mt-auto pt-6 text-micro text-brand-muted">Trusted Academic Credentials. Verified on Blockchain.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
