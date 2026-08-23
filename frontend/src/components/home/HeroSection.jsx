import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Modal } from '../ui'
import campusHero from '../../assets/images/mvjce-campus-hero.webp'

const YOUTUBE_ID = 'qrNM3axsd3Q'
const BACKGROUND_EMBED = `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_ID}&controls=0&modestbranding=1&playsinline=1&rel=0&disablekb=1&showinfo=0&iv_load_policy=3`
const MODAL_EMBED = `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&playsinline=1&rel=0&modestbranding=1`

function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsNarrow(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return isNarrow
}

function useAllowBackgroundVideo() {
  const [allow, setAllow] = useState(false)
  const isNarrow = useIsNarrowViewport()

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(() => {
      if (cancelled) return
      if (isNarrow) {
        setAllow(false)
        return
      }

      const conn = navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection
      if (conn?.saveData) {
        setAllow(false)
        return
      }
      const slow = conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g'
      setAllow(!slow)
    })

    return () => {
      cancelled = true
    }
  }, [isNarrow])

  return allow
}

function useDeferredVideoMount(sectionRef, enabled) {
  const [shouldMount, setShouldMount] = useState(false)

  useEffect(() => {
    if (!enabled || !sectionRef.current) return undefined

    const node = sectionRef.current
    let idleId = null
    let cancelled = false

    const mount = () => {
      if (cancelled) return
      const schedule =
        typeof requestIdleCallback === 'function'
          ? (cb) => requestIdleCallback(cb, { timeout: 2000 })
          : (cb) => setTimeout(cb, 400)
      idleId = schedule(() => {
        if (!cancelled) setShouldMount(true)
      })
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) mount()
      },
      { rootMargin: '0px', threshold: 0.15 },
    )
    observer.observe(node)

    return () => {
      cancelled = true
      observer.disconnect()
      if (idleId != null) {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId)
        else clearTimeout(idleId)
      }
    }
  }, [enabled, sectionRef])

  return shouldMount
}

export function HeroSection() {
  const sectionRef = useRef(null)
  const allowBackgroundVideo = useAllowBackgroundVideo()
  const mountBackgroundVideo = useDeferredVideoMount(sectionRef, allowBackgroundVideo)
  const [filmOpen, setFilmOpen] = useState(false)

  return (
    <>
      <section
        ref={sectionRef}
        className="relative isolate flex min-h-[72svh] items-center overflow-hidden sm:min-h-[78svh] lg:min-h-[88vh]"
      >
        <img
          src={campusHero}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          fetchPriority="high"
          decoding="async"
        />

        {mountBackgroundVideo && (
          <div className="absolute inset-0 -z-[15] overflow-hidden" aria-hidden="true">
            <iframe
              title=""
              src={BACKGROUND_EMBED}
              className="pointer-events-none absolute top-1/2 left-1/2 h-[56.25%] min-h-full min-w-[177.78%] -translate-x-1/2 -translate-y-1/2 scale-[1.02] border-0"
              tabIndex={-1}
              allow="autoplay; encrypted-media"
              loading="lazy"
            />
          </div>
        )}

        <div className="hero-scrim absolute inset-0 -z-10" aria-hidden="true" />
        <div className="hero-scrim-base absolute inset-x-0 bottom-0 -z-10 h-36" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-[1200px] px-5 py-20 sm:py-24 lg:px-10 lg:py-28">
          <div className="max-w-full sm:max-w-lg lg:max-w-[52%]">
            <p className="text-label text-white/80">MVJ College of Engineering</p>

            <h1 className="text-display mt-5 font-bold text-white">KREDENT</h1>

            <p className="text-h2 mt-3 font-semibold leading-[1.08] text-mvj-gold">
              Digital Academic Credentials
            </p>

            <p className="mt-6 text-body-l text-white/90">
              Issue, secure, and verify degree certificates on the Polygon network.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button to="/verify" variant="accent" size="lg">
                Verify a Credential
              </Button>
              <Button
                href="#about"
                variant="outline"
                size="lg"
                className="!border-white/50 !text-white hover:!bg-white hover:!text-mvj-navy"
              >
                About Kredent
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={() => setFilmOpen(true)}
                className="text-body font-semibold text-white underline decoration-mvj-orange decoration-2 underline-offset-4 transition-colors hover:text-mvj-orange"
              >
                Watch the campus film
              </button>
              <p className="text-caption text-white/75">
                College Administrator?{' '}
                <Link
                  to="/admin/login"
                  className="font-semibold text-white underline decoration-mvj-orange decoration-2 underline-offset-4 hover:text-mvj-orange"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <Modal open={filmOpen} onClose={() => setFilmOpen(false)} title="Campus Life 2024" size="lg">
        <div className="aspect-video w-full bg-black">
          {filmOpen && (
            <iframe
              title="Campus Life 2024 — MVJ College of Engineering"
              src={MODAL_EMBED}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          )}
        </div>
        <p className="border-t border-surface-line px-6 py-4 text-caption text-mvj-muted">
          A film by MVJ College of Engineering. Press Escape to close.
        </p>
      </Modal>
    </>
  )
}
