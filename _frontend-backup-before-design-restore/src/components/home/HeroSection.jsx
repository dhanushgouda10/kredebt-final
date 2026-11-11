import { Link } from 'react-router-dom'
import { Button } from '../ui'

function SampleVerificationCard() {
  const rows = [
    ['Certificate', 'CERT-2026-0001'],
    ['Issued by', 'Sample Institution'],
    ['Programme', 'B.E. Computer Science'],
    ['Network', 'Polygon'],
  ]
  return (
    <div className="relative mx-auto w-full max-w-md" aria-label="Illustration of a verification result">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-white/5 blur-2xl" aria-hidden="true" />
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-surface-line bg-emerald-50 px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <p className="text-caption font-bold text-emerald-800">Credential verified</p>
            <p className="text-micro text-emerald-700">Matches the on-chain record</p>
          </div>
        </div>
        <dl className="divide-y divide-surface-line px-6 py-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3">
              <dt className="text-micro text-brand-muted">{label}</dt>
              <dd className="text-caption font-semibold text-brand-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-surface-line bg-surface-sunken px-6 py-3 text-micro text-brand-muted">
          Illustration only — sample data.
        </div>
      </div>
    </div>
  )
}

/** Landing hero — product-first, no institution imagery. */
export function HeroSection() {
  return (
    <section className="hero-surface relative isolate overflow-hidden text-white">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-20 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-10 lg:py-28">
        <div>
          <p className="text-label text-teal-200">Academic credential infrastructure</p>
          <h1 className="text-display mt-5 font-extrabold">
            Trusted Academic Credentials.
            <span className="mt-1 block text-teal-300">Verified on Blockchain.</span>
          </h1>
          <p className="text-body-l mt-7 max-w-xl text-white/80">
            Kredent lets any college or university issue tamper-evident certificates, and lets employers,
            universities and agencies confirm they are genuine in seconds &mdash; no phone calls, no paper trail.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button to="/verify" variant="accent" size="lg" className="!bg-teal-500 hover:!bg-teal-400">
              Verify a certificate
            </Button>
            <Button
              to="/admin/login"
              variant="outline"
              size="lg"
              className="!border-white/40 !text-white hover:!bg-white hover:!text-brand-primary"
            >
              I represent an institution
            </Button>
          </div>

          <p className="mt-6 text-caption text-white/60">
            Students: <Link to="/login" className="font-semibold text-white underline underline-offset-4">sign in to your portal</Link>
          </p>
        </div>

        <SampleVerificationCard />
      </div>
    </section>
  )
}
