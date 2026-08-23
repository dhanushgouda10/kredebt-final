/**
 * Base card shell — border only, no shadow. Portal surfaces use rules and
 * whitespace, not lifted cards on every block.
 */
export function Card({ children, className = '', elevated = false, as: Comp = 'div', ...rest }) {
  return (
    <Comp
      className={`overflow-hidden rounded-lg border border-surface-line bg-surface-raised ${
        elevated ? 'shadow-card' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Comp>
  )
}

/** Flat navy header bar for form/table cards — no icon chip. */
export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`border-b border-white/10 bg-mvj-navy px-6 py-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-h3 font-bold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-caption text-white/75">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-6 md:p-8 ${className}`}>{children}</div>
}
