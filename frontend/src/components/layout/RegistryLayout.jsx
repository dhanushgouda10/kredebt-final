import { NavLink, Link, Outlet } from 'react-router-dom'
import { RegistryEmblem } from '../registry/RegistryEmblem'

const NAV = [
  { to: '/registry', label: 'Home', end: true },
  { to: '/registry#approved', label: 'Approved Institutions', hash: true },
  { to: '/registry/register', label: 'Register Institution' },
  { to: '/registry/verify-email', label: 'Verify Email' },
]

/**
 * Shell for the institutional registry portal: utility bar, emblem + title header, primary navigation,
 * page body and footer. Deliberately its own identity — no AICTE or government marks.
 */
export function RegistryLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6fb]">
      <div className="bg-[#081c3f] text-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-1.5 text-caption">
          <span>Institutional Registry Portal</span>
          <Link to="/registry/register" className="font-semibold hover:underline">Register Institution</Link>
        </div>
      </div>

      <header className="border-b border-surface-line bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-5 py-4">
          <RegistryEmblem />
          <div>
            <p className="font-display text-h3 font-bold leading-tight text-brand-primary">Institutional Registry Portal</p>
            <p className="text-caption text-brand-muted">Registration of institutions</p>
          </div>
        </div>
        <nav className="bg-brand-primary" aria-label="Registry">
          <ul className="mx-auto flex max-w-[1200px] flex-wrap px-3">
            {NAV.map((item) => (
              <li key={item.to}>
                {item.hash ? (
                  <a href={item.to} className="block px-4 py-3 text-caption font-semibold text-white hover:bg-white/10">
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block border-b-4 px-4 py-3 text-caption font-semibold text-white ${
                        isActive ? 'border-brand-accent bg-white/10' : 'border-transparent hover:bg-white/10'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-8">
        <Outlet />
      </main>

      <footer className="bg-[#081c3f] text-white/80">
        <div className="mx-auto max-w-[1200px] px-5 py-5 text-caption">
          An independent institutional registry &mdash; not affiliated with AICTE or any government body.
        </div>
      </footer>
    </div>
  )
}
