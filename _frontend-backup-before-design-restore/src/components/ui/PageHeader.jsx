/**
 * Standard page title block — left-aligned, restrained type scale, no motion.
 */
export function PageHeader({ eyebrow, title, subtitle, actions, align = 'left', className = '' }) {
  const centered = align === 'center'

  return (
    <div className={`mb-10 ${centered ? 'text-center' : ''} ${className}`}>
      <div
        className={
          centered ? '' : 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'
        }
      >
        <div className={centered ? '' : 'min-w-0'}>
          {eyebrow && <p className="text-label mb-3 text-brand-accent">{eyebrow}</p>}
          <h1 className={`text-h2 font-bold text-brand-primary ${centered ? 'mx-auto max-w-2xl' : ''}`}>
            {title}
          </h1>
          {subtitle && (
            <p
              className={`text-body-l mt-4 text-brand-muted ${centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-3">{actions}</div>}
      </div>
      {!centered && <div className="mt-6 h-px w-full bg-surface-line" />}
    </div>
  )
}
