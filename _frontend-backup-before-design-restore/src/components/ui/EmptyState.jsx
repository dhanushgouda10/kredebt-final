export function EmptyState({ title, description, action, className = '' }) {
  return (
    <div className={`px-6 py-16 text-center ${className}`}>
      <h3 className="text-h3 font-bold text-brand-primary">{title}</h3>
      {description && <p className="mx-auto mt-3 max-w-sm text-body text-brand-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
