import { Link } from 'react-router-dom'
import { BRAND_TAGLINE, KredentLogo } from '../brand/KredentLogo'

const platformLinks = [
  { label: 'Verify a Certificate', to: '/verify' },
  { label: 'Student Portal', to: '/login' },
  { label: 'Institution Sign-in', to: '/admin/login' },
]

const institutionLinks = [
  { label: 'Verify your institution', to: '/admin/login' },
  { label: 'Demo Institutional Registry', to: '/registry' },
  { label: 'Register a college (demo)', to: '/registry/register' },
]

function FooterColumn({ title, links }) {
  return (
    <div>
      <h3 className="text-label text-white/55">{title}</h3>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link to={link.to} className="text-caption text-white/80 transition hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Neutral product footer — no institution-specific content. */
export function Footer() {
  return (
    <footer className="bg-brand-primary-deep text-white">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-10 lg:py-16">
        <div>
          <KredentLogo tone="light" markClassName="h-10 w-10" />
          <p className="mt-5 max-w-sm text-caption text-white/70">{BRAND_TAGLINE}</p>
          <p className="mt-4 max-w-sm text-caption text-white/55">
            One platform for any college or university to issue tamper-evident academic certificates, and for
            anyone to verify them in seconds.
          </p>
        </div>

        <FooterColumn title="Platform" links={platformLinks} />
        <FooterColumn title="For institutions" links={institutionLinks} />
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 text-micro text-white/55 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>&copy; {new Date().getFullYear()} Kredent. All rights reserved.</p>
          <p className="max-w-xl sm:text-right">
            The institutional registry shown in this demo is a simulation and is not affiliated with AICTE or any
            government body.
          </p>
        </div>
      </div>
    </footer>
  )
}
