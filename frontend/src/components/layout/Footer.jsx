import { Link } from 'react-router-dom'
import { KredentMark, BRAND_NAME, BRAND_TAGLINE } from '../brand/KredentLogo'

/**
 * Platform footer — three-zone architecture.
 *
 * Zone A: Charcoal rail with the Kredent mark and short platform notes
 * Zone B: Navy body with link columns
 * Zone C: Blush strip with the registry independence note
 */
const columns = [
  {
    title: 'Verify',
    links: [
      { label: 'Verify a Certificate', to: '/verify' },
    ],
  },
  {
    title: 'Institutions',
    links: [
      { label: 'Verify Your Institution', to: '/admin/login' },
      { label: 'Register College', to: '/registry/register', newTab: true },
    ],
  },
  {
    title: 'Students',
    links: [
      { label: 'Student Sign In', to: '/login' },
      { label: 'My Certificates', to: '/student/certificates' },
    ],
  },
  {
    title: 'Network',
    links: [{ label: 'Polygon Amoy Explorer', href: 'https://amoy.polygonscan.com/' }],
  },
]

const linkClass =
  'text-caption text-white/80 transition-colors hover:text-white hover:underline decoration-[#F7941D] underline-offset-2'

export function Footer() {
  return (
    <footer className="bg-[#0E2A5C] text-white">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid lg:grid-cols-[23%_1fr]">
          {/* Zone A: Charcoal rail */}
          <div className="bg-[#231F20] p-8 lg:p-10">
            <div className="mb-6 flex items-center gap-3">
              <KredentMark className="h-14 w-14" />
              <div>
                <p className="heading-serif text-body-l font-bold leading-tight text-white">{BRAND_NAME}</p>
                <p className="text-micro leading-tight text-white/70">Academic credential platform</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-label mb-2 font-bold uppercase tracking-[0.22em] text-[#E9B949]">About</h3>
                <p className="text-caption leading-relaxed text-white/90">{BRAND_TAGLINE}</p>
              </div>
              <div>
                <h3 className="text-label mb-2 font-bold uppercase tracking-[0.22em] text-[#E9B949]">Issuance</h3>
                <p className="text-caption leading-relaxed text-white/90">
                  Certificates are issued by verified institutions and recorded on the Polygon network.
                </p>
              </div>
            </div>
          </div>

          {/* Zone B: Navy link columns */}
          <div className="p-8 lg:p-10 lg:pl-12">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              {columns.map((col) => (
                <div key={col.title}>
                  <h3 className="mb-4 text-micro font-bold uppercase tracking-[0.16em] text-white">{col.title}</h3>
                  <ul className="space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        {link.to ? (
                          <Link to={link.to} className={linkClass} {...(link.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                            {link.label}
                          </Link>
                        ) : (
                          <a href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
                            {link.label}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zone C: Blush highlight strip */}
        <div className="border-t border-dashed border-[#CE2A26] bg-[#FCEAEA]">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-2 px-5 py-4 text-center sm:flex-row sm:text-left lg:px-10">
            <p className="text-caption font-semibold text-[#CE2A26]">
              Kredent’s institutional registry is independent and is not affiliated with AICTE or any regulator.
            </p>
            <p className="text-caption text-[#5A6B84]">&copy; {new Date().getFullYear()} {BRAND_NAME}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
