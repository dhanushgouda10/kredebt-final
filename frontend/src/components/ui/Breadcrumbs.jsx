import { Link } from 'react-router-dom'

/**
 * Simple breadcrumb trail for deeper pages (certificate detail, student
 * detail, etc.). `items` is an ordered array of `{ label, to }` — the last
 * item is rendered as the current page (no link, aria-current). Intentionally
 * not used on shallow pages (landing, login, verify form) per design brief —
 * only wire this in where there's an actual hierarchy to show.
 */
export function Breadcrumbs({ items = [], className = '' }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={`mb-4 ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5 text-caption text-mvj-muted/75">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && (
                <svg className="h-3.5 w-3.5 flex-shrink-0 text-surface-line-strong" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isLast || !item.to ? (
                <span aria-current={isLast ? 'page' : undefined} className="font-medium text-mvj-muted">
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="transition hover:text-kredent-accent">
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
