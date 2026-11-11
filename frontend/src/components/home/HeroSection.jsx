import { Link } from 'react-router-dom'
import { Button } from '../ui'

/**
 * Landing hero — the original layout (left-weighted scrim, display wordmark, gold sub-heading,
 * two calls to action) over a neutral navy backdrop instead of institution photography.
 */
export function HeroSection() {
  return (
    <section className="hero-surface relative isolate flex min-h-[72svh] items-center overflow-hidden sm:min-h-[78svh] lg:min-h-[88vh]">
      <div className="absolute inset-y-0 right-0 -z-20 hidden w-[48%] lg:block" aria-hidden="true">
        <img
          src="/images/campus-students.webp"
          alt=""
          className="h-full w-full object-cover object-[50%_30%]"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-primary via-brand-primary/50 to-transparent" />
      </div>
      <div className="hero-scrim absolute inset-0 -z-10" aria-hidden="true" />
      <div className="hero-scrim-base absolute inset-x-0 bottom-0 -z-10 h-36" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-[1200px] px-5 py-20 sm:py-24 lg:px-10 lg:py-28">
        <div className="max-w-full sm:max-w-lg lg:max-w-[52%]">
          <p className="text-label text-white/80">Academic credential infrastructure</p>

          <h1 className="text-display mt-5 font-bold text-white">KREDENT</h1>

          <p className="text-h2 mt-3 font-semibold leading-[1.08] text-brand-gold">
            Digital Academic Credentials
          </p>

          <p className="mt-6 text-body-l text-white/90">
            Trusted Academic Credentials. Verified on Blockchain.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button to="/verify" variant="accent" size="lg">
              Verify a Credential
            </Button>
            <Button
              href="#about"
              variant="outline"
              size="lg"
              className="!border-white/50 !text-white hover:!bg-white hover:!text-brand-primary"
            >
              About Kredent
            </Button>
          </div>

          <p className="mt-8 text-caption text-white/75">
            Institution administrator?{' '}
            <Link
              to="/admin/login"
              className="font-semibold text-white underline decoration-brand-accent decoration-2 underline-offset-4 hover:text-brand-accent"
            >
              Verify your institution
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
