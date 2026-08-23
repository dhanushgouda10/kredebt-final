/**
 * Dashboard statistic — label + value only. No icon chip.
 */
export function StatCard({ label, value, valueClassName = 'text-mvj-navy' }) {
  return (
    <div className="rounded-lg border border-surface-line bg-surface-raised px-6 py-5">
      <p className="text-label text-mvj-muted">{label}</p>
      <p className={`heading-serif mt-2 text-h3 font-bold ${valueClassName}`}>{value}</p>
    </div>
  )
}
