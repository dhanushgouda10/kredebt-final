import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Intelligent "go back" control. If the user actually navigated here from
 * somewhere inside the app (browser history exists), it goes back one step
 * — preserving their scroll position / filters / whatever they had. If this
 * page was opened directly (fresh tab, QR scan, bookmarked link — no prior
 * history), `navigate(-1)` would either do nothing or leave the app, so it
 * falls back to `fallbackTo` instead.
 *
 * `location.key === 'default'` is React Router's own signal for "this is the
 * first entry in the session" — the standard way to detect this without
 * reaching into raw browser history state.
 */
export function BackButton({ label = 'Back', fallbackTo = '/', className = '' }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = () => {
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      navigate(fallbackTo)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-caption font-semibold text-kredent-navy transition hover:text-kredent-accent ${className}`}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  )
}
