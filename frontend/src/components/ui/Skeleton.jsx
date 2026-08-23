export function Skeleton({ className = '' }) {
  return <div className={`relative overflow-hidden rounded-md bg-surface-sunken/80 skeleton-shimmer ${className}`} />
}

/** A few lines of skeleton text, e.g. while a result is loading. */
export function SkeletonLines({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-1/2' : i === lines - 2 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** Skeleton placeholder shaped like a table row, for loading tables/lists. */
export function SkeletonRow({ columns = 4 }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full max-w-[10rem]" />
        </td>
      ))}
    </tr>
  )
}

/** Skeleton placeholder shaped like a StatCard, for loading dashboard stats. */
export function SkeletonStatCard() {
  return (
    <div className="rounded-lg border border-surface-line bg-surface-raised px-6 py-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-14" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    </div>
  )
}
