const VARIANTS = {
  error: {
    wrap: 'border-red-200 bg-red-50 text-red-800',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  success: {
    wrap: 'border-green-200 bg-green-50 text-green-800',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      </svg>
    ),
  },
  info: {
    wrap: 'border-blue-200 bg-blue-50 text-blue-800',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

export function Alert({ variant = 'info', title, children, className = '' }) {
  const config = VARIANTS[variant] ?? VARIANTS.info

  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-caption ${config.wrap} ${className}`}>
      {config.icon}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  )
}
