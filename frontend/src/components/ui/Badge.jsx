const STATUS_MAP = {
  valid: 'success',
  active: 'success',
  verified: 'success',
  revoked: 'danger',
  invalid: 'danger',
  pending: 'warning',
  draft: 'neutral',
}

const VARIANTS = {
  success: 'bg-green-100 text-green-800',
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-surface-sunken text-mvj-muted',
}

const DOT_COLORS = {
  success: 'bg-green-600',
  danger: 'bg-red-600',
  warning: 'bg-amber-600',
  info: 'bg-blue-600',
  neutral: 'bg-mvj-muted',
}

/**
 * Status pill. Pass `status="Valid" | "Revoked" | ...` to auto-pick a
 * color, or `variant` directly for full control. Includes a small color dot
 * by default — a quick-scan convention used across most dashboard-style
 * status indicators, set `dot={false}` to opt out where space is tight.
 */
export function Badge({ status, variant, children, dot = true, className = '' }) {
  const resolved = variant ?? STATUS_MAP[status?.toLowerCase()] ?? 'neutral'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold ${VARIANTS[resolved]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_COLORS[resolved]}`} aria-hidden="true" />}
      {children ?? status}
    </span>
  )
}
