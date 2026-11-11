import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { KredentMark } from '../brand/KredentLogo'
import { useAuth } from '../../context/useAuth'

const links = [
  {
    to: '/admin/students',
    label: 'Students',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    to: '/admin/issue-degree',
    label: 'Issue Degree',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    to: '/admin/issued-certificates',
    label: 'Issued Certificates',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: '/admin/audit-logs',
    label: 'Audit Logs',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h3m-7 5h10a2 2 0 002-2V7a2 2 0 00-2-2h-2.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0011.586 3H8a2 2 0 00-2 2v13a2 2 0 002 2z" />
      </svg>
    ),
  },
]

function SidebarNav({ onNavigate }) {
  const { institution, logout } = useAuth()
  return (
    <>
      <div className="mb-8 px-2">
        <div className="flex items-center gap-3">
          <KredentMark className="h-9 w-9" />
          <div>
            <p className="heading-serif text-h3 leading-tight">Kredent</p>
            <p className="text-micro tracking-wide text-white/60">Admin Portal</p>
          </div>
        </div>
        {institution && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/10 px-4 py-3">
            <p className="text-micro uppercase tracking-wider text-white/55">Signed in as</p>
            <p className="mt-1 text-caption font-semibold leading-snug">{institution.name}</p>
            <p className="mt-0.5 text-micro text-white/60">
              {institution.district}, {institution.state}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-micro font-semibold text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
              Verified institution
            </p>
          </div>
        )}
      </div>
      <nav className="space-y-1.5">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-caption font-semibold transition ${
                isActive
                  ? 'bg-brand-accent text-white shadow-md'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg border border-white/15 px-4 py-2.5 text-caption font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Sign out
        </button>
        <p className="text-micro text-white/40">Kredent · Academic Credential Platform</p>
      </div>
    </>
  )
}

function MobileBarBrand() {
  const { institution } = useAuth()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <KredentMark className="h-8 w-8" />
      <div className="min-w-0">
        <p className="heading-serif text-body-l leading-tight">Kredent Admin</p>
        {institution && <p className="truncate text-micro leading-tight text-white/65">{institution.name}</p>}
      </div>
    </div>
  )
}

/**
 * Admin sidebar. On desktop (md+) this is a permanent left column, unchanged from before. On
 * mobile it previously rendered as a full-width block stacked ABOVE the page content (because
 * the parent layout is `flex-col md:flex-row`) — meaning a phone user had to scroll past the
 * entire nav list before reaching the actual page. Now mobile gets a slim top bar with a
 * hamburger that opens the same nav as a slide-in drawer, matching the pattern already
 * established by the public Navbar's mobile menu.
 */
export function DashboardSidebar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-brand-primary px-4 py-3 text-white md:hidden">
        <MobileBarBrand />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={isOpen}
          className="rounded-full p-2 transition hover:bg-white/10 active:scale-95"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Desktop permanent sidebar */}
      <aside className="hidden min-h-full flex-col bg-brand-primary px-4 py-6 text-white md:flex md:w-64 md:flex-shrink-0">
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/30 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false)
            }}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="fixed left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col bg-brand-primary px-4 py-6 text-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="mb-4 ml-auto rounded-full p-2 transition hover:bg-white/10"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <SidebarNav onNavigate={() => setIsOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
