import { useState } from 'react'

/**
 * Small copy-to-clipboard icon button for technical values (hashes, tx IDs,
 * wallet/contract addresses) that are correct-but-unreadable at a glance.
 * Promoted out of StudentCertificateDetailPage (where it started as a local
 * component) so the same control is reused verbatim in the admin certificate
 * modal and student detail pages instead of being re-implemented per file.
 * Purely presentational — never touches the underlying value it copies.
 */
export function CopyButton({ value, label = 'value', className = '' }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  const handleCopy = () => {
    navigator.clipboard?.writeText(String(value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      title={copied ? 'Copied!' : `Copy ${label}`}
      className={`flex-shrink-0 rounded p-1 text-brand-muted/75 transition hover:bg-surface-sunken hover:text-brand-muted ${className}`}
    >
      {copied ? (
        <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  )
}
