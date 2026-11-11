/**
 * Read-only registry details. Nothing here is editable on purpose: the name, location and — above
 * all — the HOI email come from the registry, and the one-time code can only go to that address.
 */
export function InstitutionDetails({ details }) {
  const rows = [
    ['College name', details.name],
    ['State', details.state],
    ['District', details.district],
    ['Registered HOI email', details.hoiEmail],
  ]
  return (
    <dl className="divide-y divide-surface-line rounded-xl border border-surface-line bg-surface-page">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-micro font-semibold uppercase tracking-wider text-brand-muted">{label}</dt>
          <dd className="break-words text-caption font-semibold text-brand-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
