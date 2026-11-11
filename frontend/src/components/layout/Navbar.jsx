import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { KredentMark, BRAND_NAME } from '../brand/KredentLogo'

const utilityLinks = [
  { label: 'Verify Certificate', to: '/verify' },
  { label: 'For Institutions', to: '/admin/login' },
  { label: 'Institutional Registry', to: '/registry' },
  { label: 'Student Portal', to: '/login' },
]

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Verify', to: '/verify' },
  { label: 'Student Portal', to: '/login' },
  { label: 'Administration', to: '/admin/login' },
]

function Brand({ compact = false }) {
  return (
    <NavLink to="/" className="flex items-center gap-3 min-w-0" aria-label="Kredent home">
      <KredentMark className={compact ? 'h-9 w-9' : 'h-12 w-12 lg:h-14 lg:w-14'} />
      {!compact && (
        <span className="min-w-0 hidden sm:block">
          <span className="heading-serif block text-h3 font-bold leading-tight text-brand-primary">
            {BRAND_NAME}
          </span>
          <span className="mt-0.5 block text-label normal-case tracking-[0.08em] text-brand-danger">
            Academic Credentials
          </span>
        </span>
      )}
    </NavLink>
  )
}

function SearchIcon({ className = 'w-[18px] h-[18px]' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function MenuIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [collapseTier1, setCollapseTier1] = useState(false)
  const menuButtonRef = useRef(null)
  const drawerRef = useRef(null)

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY
      setIsScrolled(scrollY > 12)
      setCollapseTier1(scrollY > 100)
    }
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

    const focusTarget = drawerRef.current?.querySelector('button[aria-label="Close menu"]')
    focusTarget?.focus()
    const trigger = menuButtonRef.current

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [isMenuOpen])

  return (
    <header
      className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${
        isScrolled ? 'shadow-[0_2px_20px_rgba(14,42,92,0.14)]' : ''
      }`}
    >
      {/* Desktop / tablet — two-tier grid */}
      <div className="hidden lg:block">
        <div className="nav-header-grid">
          <div className="nav-logo-plate">
            <Brand />
          </div>

          <motion.div
            initial={false}
            animate={{ height: collapseTier1 ? 0 : 'auto', opacity: collapseTier1 ? 0 : 1 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="nav-tier-utility-slot"
          >
            <div className="nav-tier-utility">
              {utilityLinks.map((link) => (
                <NavLink
                  key={link.label}
                  to={link.to}
                  className="whitespace-nowrap text-caption text-white transition-colors hover:text-brand-accent"
                >
                  {link.label}
                </NavLink>
              ))}

              <NavLink
                to="/registry/register" target="_blank" rel="noopener noreferrer"
                className="whitespace-nowrap rounded-md bg-brand-accent px-4 py-1.5 text-caption font-semibold text-white transition-colors hover:bg-brand-accent-deep"
              >
                Register Institution
              </NavLink>

              <NavLink
                to="/verify"
                className="whitespace-nowrap rounded-md bg-brand-danger px-4 py-1.5 text-caption font-semibold text-white transition-colors hover:bg-brand-primary-deep"
              >
                Verify Credential
              </NavLink>

              <button
                type="button"
                aria-label="Search"
                className="p-1.5 text-white transition-colors hover:text-[#F7941D]"
              >
                <SearchIcon />
              </button>

              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={isMenuOpen}
                className="p-1.5 text-white transition-colors hover:text-[#F7941D]"
              >
                <MenuIcon />
              </button>
            </div>
          </motion.div>

          <div className="nav-tier-primary">
            <nav className="w-full" aria-label="Main">
              <ul className="flex flex-wrap items-center gap-x-8 gap-y-2 xl:gap-x-10">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `relative py-1 text-label normal-case tracking-[0.1em] transition-colors duration-150 ${
                          isActive ? 'text-brand-primary' : 'text-brand-charcoal hover:text-brand-danger'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {item.label}
                          {isActive && (
                            <motion.span
                              layoutId="navbar-active-underline"
                              className="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full bg-[#F7941D]"
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile — compact single bar */}
      <div className="flex items-center justify-between border-b border-surface-line px-4 py-3 lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-1">
          <NavLink
            to="/verify"
            className="rounded bg-[#F7941D] px-3 py-1.5 text-micro font-semibold text-white"
          >
            Verify
          </NavLink>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            className="rounded-lg p-2 text-[#0E2A5C] transition hover:bg-surface-sunken"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Drawer — mobile + desktop hamburger */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMenuOpen(false)
            }}
          >
            <motion.div
              ref={drawerRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 260 }}
              className="fixed right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
            >
              <div className="flex items-center justify-between border-b border-surface-line px-5 py-4">
                <Brand compact />
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg p-2 text-[#0E2A5C] transition hover:bg-surface-sunken"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-5" aria-label="Mobile">
                <p className="mb-2 px-4 text-micro font-bold uppercase tracking-[0.16em] text-[#5A6B84]">
                  Platform
                </p>
                <ul className="mb-6 space-y-1">
                  {navItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setIsMenuOpen(false)}
                        className={({ isActive }) =>
                          `block rounded-lg px-4 py-3 text-caption font-semibold uppercase tracking-wide transition ${
                            isActive ? 'bg-[#0E2A5C]/10 text-[#0E2A5C]' : 'text-[#231F20] hover:bg-surface-sunken'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>

                <p className="mb-2 px-4 text-micro font-bold uppercase tracking-[0.16em] text-[#5A6B84]">
                  Institutions
                </p>
                <ul className="space-y-1">
                  {utilityLinks.map((link) => (
                    <li key={link.label}>
                      <NavLink
                        to={link.to}
                        onClick={() => setIsMenuOpen(false)}
                        className="block rounded-lg px-4 py-2.5 text-caption text-[#231F20] transition hover:bg-surface-sunken"
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="border-t border-surface-line px-5 py-4">
                <NavLink
                  to="/registry/register" target="_blank" rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 text-caption font-semibold text-[#CE2A26] hover:underline"
                >
                  Register your institution
                </NavLink>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
