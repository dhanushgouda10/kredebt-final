/** Horizontal progress indicator for the institution verification wizard. */
export function Stepper({ steps, current }) {
  return (
    <ol className="flex items-center" aria-label="Verification progress">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`} aria-current={active ? 'step' : undefined}>
            <span
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-micro font-bold transition ${
                done
                  ? 'bg-brand-accent text-white'
                  : active
                    ? 'bg-brand-primary text-white ring-4 ring-brand-primary/15'
                    : 'bg-surface-sunken text-brand-muted'
              }`}
            >
              {done ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span
              className={`ml-2 hidden text-micro font-semibold sm:inline ${
                active ? 'text-brand-primary' : done ? 'text-brand-ink' : 'text-brand-muted'
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className={`mx-3 h-px flex-1 ${done ? 'bg-brand-accent' : 'bg-surface-line-strong'}`} aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}
