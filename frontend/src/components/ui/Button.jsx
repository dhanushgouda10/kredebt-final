import { Link } from 'react-router-dom'

const VARIANTS = {
  primary:
    'bg-brand-primary text-white hover:bg-brand-primary-deep disabled:bg-brand-muted',
  accent:
    'bg-brand-accent text-white hover:bg-brand-accent-deep disabled:bg-brand-muted',
  outline:
    'border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white disabled:border-surface-line-strong disabled:text-brand-muted disabled:hover:bg-transparent',
  ghost: 'text-brand-primary hover:bg-brand-primary/8 disabled:text-brand-muted',
  danger:
    'border-2 border-brand-danger text-brand-danger hover:bg-brand-danger hover:text-white disabled:border-surface-line-strong disabled:text-brand-muted',
  pill: 'bg-brand-accent text-white hover:bg-brand-accent-deep disabled:bg-brand-muted rounded-full',
}

const SIZES = {
  sm: 'px-4 py-2 text-label normal-case tracking-normal',
  md: 'px-6 py-3 text-caption',
  lg: 'px-8 py-3.5 text-body',
}

/**
 * Shared button primitive. Flat fills only — no gradients, no hover lift.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon = null,
  iconPosition = 'left',
  to,
  href,
  className = '',
  children,
  type = 'button',
  ...rest
}) {
  const isDisabled = disabled || loading
  const shape = variant === 'pill' ? 'rounded-full' : 'rounded-md'

  const classes = [
    'inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-150',
    'disabled:cursor-not-allowed',
    shape,
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {loading ? (
        <span
          className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
          aria-hidden="true"
        />
      ) : (
        icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-disabled={isDisabled}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    )
  }

  return (
    <button type={type} disabled={isDisabled} className={classes} {...rest}>
      {content}
    </button>
  )
}
