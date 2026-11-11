import { Link, Outlet } from 'react-router-dom'
import { KredentMark } from '../brand/KredentLogo'

/**
 * Shell for the SIMULATED institutional registry. Deliberately looks different from Kredent and
 * carries a permanent banner: this is a classroom demonstration, not an official government portal.
 */
export function RegistryLayout() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div role="note" className="bg-amber-100 px-4 py-2 text-center text-caption font-semibold text-amber-900">
        DEMONSTRATION ONLY &mdash; this is a simulated institutional registry. It is not an official government
        or regulator portal and is not affiliated with any such body.
      </div>
      <header className="border-b border-surface-line bg-surface-raised">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/registry" className="text-h3 font-bold text-brand-primary">
            Demo Institutional Registry
          </Link>
          <nav className="flex flex-wrap items-center gap-5 text-caption font-semibold text-brand-muted">
            <Link to="/registry/register" className="hover:text-brand-ink">Register college</Link>
            <Link to="/registry/verify-email" className="hover:text-brand-ink">Verify email</Link>
            <Link to="/registry/admin" className="hover:text-brand-ink">Registry admin</Link>
            <Link to="/" className="inline-flex items-center gap-1.5 text-brand-primary hover:text-brand-ink">
              <KredentMark className="h-5 w-5" /> Back to Kredent
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-5 py-10">
        <Outlet />
      </main>
    </div>
  )
}
