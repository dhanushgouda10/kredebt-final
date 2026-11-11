/**
 * Kredent identity: a shield-and-check mark with a wordmark. Neutral by design — it belongs to the
 * platform, never to any one institution.
 */
export const BRAND_NAME = 'KREDENT'
export const BRAND_TAGLINE = 'Trusted Academic Credentials. Verified on Blockchain.'

export function KredentMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 40 40" className={`shrink-0 ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="kredent-mark-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#kredent-mark-gradient)" />
      <path
        d="M20 8.5l9 3.4v7.2c0 5.6-3.7 9.6-9 11.9-5.3-2.3-9-6.3-9-11.9v-7.2l9-3.4z"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M15.8 19.6l3 3 5.6-6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * @param tone     'dark' text for light backgrounds, 'light' text for dark backgrounds
 * @param tagline  show the tagline under the wordmark
 */
export function KredentLogo({ tone = 'dark', tagline = false, markClassName = 'h-9 w-9', className = '' }) {
  const wordColor = tone === 'light' ? 'text-white' : 'text-brand-primary'
  const subColor = tone === 'light' ? 'text-white/65' : 'text-brand-muted'
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <KredentMark className={markClassName} />
      <span className="min-w-0">
        <span className={`heading-serif block text-[1.35rem] font-extrabold leading-none tracking-[0.12em] ${wordColor}`}>
          {BRAND_NAME}
        </span>
        {tagline && <span className={`mt-1 block text-micro leading-tight ${subColor}`}>{BRAND_TAGLINE}</span>}
      </span>
    </span>
  )
}
