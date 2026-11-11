import { useMemo, useState } from 'react'
import { Select } from '../ui'

const SEARCH_THRESHOLD = 8

/**
 * Plain dropdown of the registered colleges. Colleges that have not completed verification on the
 * platform yet are listed but disabled, so the student sees why they cannot pick them. With many
 * colleges a small search box narrows the list.
 */
export function CollegeSelect({ colleges, value, onChange, loading = false, error = '', name = 'institutionId', label = 'College' }) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? colleges.filter((c) => `${c.name} ${c.district} ${c.state}`.toLowerCase().includes(q)) : colleges
    // keep the selected college in the list even when the filter would hide it
    const selected = colleges.find((c) => c.institutionId === value)
    return selected && !list.includes(selected) ? [selected, ...list] : list
  }, [colleges, query, value])

  const noColleges = !loading && !error && colleges.length === 0

  return (
    <div className="space-y-2">
      {colleges.length > SEARCH_THRESHOLD && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your college"
          aria-label="Search colleges"
          className="w-full rounded-md border border-surface-line bg-surface-raised px-3 py-2 text-caption"
        />
      )}
      <Select
        label={label}
        name={name}
        value={value}
        onChange={onChange}
        required
        disabled={loading || colleges.length === 0}
      >
        <option value="">{loading ? 'Loading colleges…' : 'Select your college'}</option>
        {visible.map((c) => (
          <option key={c.institutionId} value={c.institutionId} disabled={!c.joinedKredent}>
            {c.name} — {c.district}, {c.state}
            {c.joinedKredent ? '' : ' (not available yet)'}
          </option>
        ))}
      </Select>
      {error && <p role="alert" className="text-caption text-red-700">{error}</p>}
      {noColleges && <p className="text-caption text-brand-muted">No colleges are registered yet.</p>}
    </div>
  )
}
