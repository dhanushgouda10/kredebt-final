import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../../components/ui'
import { listApprovedInstitutions } from '../../services/registryService'

const FIELD = 'w-full rounded border border-[#c9d2e3] bg-white px-3 py-2 text-caption'

export function RegistryHomePage() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    let cancelled = false
    listApprovedInstitutions()
      .then((list) => !cancelled && setRows(list))
      .catch((e) => !cancelled && setError(e.message || 'Could not load the list of institutions.'))
    return () => {
      cancelled = true
    }
  }, [])

  const states = useMemo(() => [...new Set((rows ?? []).map((r) => r.state))].sort(), [rows])
  const districts = useMemo(
    () => [...new Set((rows ?? []).filter((r) => !stateFilter || r.state === stateFilter).map((r) => r.district))].sort(),
    [rows, stateFilter],
  )
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows ?? []).filter(
      (r) =>
        (!stateFilter || r.state === stateFilter) &&
        (!districtFilter || r.district === districtFilter) &&
        (!q || `${r.name} ${r.institutionId}`.toLowerCase().includes(q)),
    )
  }, [rows, query, stateFilter, districtFilter])

  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const current = Math.min(page, pages)
  const visible = shown.slice((current - 1) * pageSize, current * pageSize)
  const reset = (fn) => (e) => {
    fn(e.target.value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-caption text-brand-muted">
        <span>Home</span> <span aria-hidden="true">/</span> <span className="font-semibold text-brand-primary">Approved Institutions</span>
      </nav>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border-l-4 border-brand-accent bg-white p-5 shadow-sm">
          <p className="text-label text-brand-muted">Approved institutions</p>
          <p className="mt-1 text-h2 font-bold text-brand-primary">{rows ? rows.length : '—'}</p>
        </div>
        <div className="rounded border-l-4 border-brand-primary bg-white p-5 shadow-sm">
          <p className="text-label text-brand-muted">States covered</p>
          <p className="mt-1 text-h2 font-bold text-brand-primary">{rows ? states.length : '—'}</p>
        </div>
        <Link to="/registry/register" className="flex items-center justify-between rounded bg-brand-accent p-5 font-semibold text-white shadow-sm hover:bg-brand-accent-deep">
          <span>New institution?<br /><span className="text-h3">Register Institution</span></span>
          <span aria-hidden="true" className="text-h2">&rarr;</span>
        </Link>
      </div>

      <section id="approved" aria-labelledby="approved-h" className="rounded border border-[#d5dcec] bg-white shadow-sm">
        <h1 id="approved-h" className="rounded-t bg-brand-primary px-5 py-3 text-body-l font-semibold text-white">
          Approved Institutions
        </h1>

        <div className="grid gap-3 border-b border-[#d5dcec] bg-[#eef2fa] p-4 sm:grid-cols-3">
          <label className="text-caption font-semibold text-brand-primary">
            State
            <select className={`${FIELD} mt-1`} value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setDistrictFilter(''); setPage(1) }}>
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-caption font-semibold text-brand-primary">
            District
            <select className={`${FIELD} mt-1`} value={districtFilter} onChange={reset(setDistrictFilter)}>
              <option value="">All districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="text-caption font-semibold text-brand-primary">
            Search
            <input type="search" className={`${FIELD} mt-1`} value={query} onChange={reset(setQuery)} placeholder="Institution name or ID" />
          </label>
        </div>

        {error && <div className="p-4"><Alert variant="error">{error}</Alert></div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-caption">
            <thead className="bg-[#dfe6f4] text-brand-primary">
              <tr>
                <th className="px-4 py-3">Sr. No.</th>
                <th className="px-4 py-3">Institutional ID</th>
                <th className="px-4 py-3">Institution Name</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && !error && <tr><td colSpan={6} className="px-4 py-6 text-brand-muted">Loading&hellip;</td></tr>}
              {rows !== null && visible.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-brand-muted">No institutions found.</td></tr>}
              {visible.map((r, i) => (
                <tr key={r.institutionId} className="border-t border-[#e3e8f3] odd:bg-white even:bg-[#f8faff]">
                  <td className="px-4 py-3">{(current - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-3 font-semibold">{r.institutionId}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.state}</td>
                  <td className="px-4 py-3">{r.district}</td>
                  <td className="px-4 py-3"><span className="rounded bg-green-100 px-2 py-0.5 font-semibold text-green-800">Approved</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d5dcec] px-4 py-3 text-caption text-brand-muted">
          <span>Showing {visible.length ? (current - 1) * pageSize + 1 : 0}&ndash;{(current - 1) * pageSize + visible.length} of {shown.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded border border-[#c9d2e3] px-3 py-1 font-semibold disabled:opacity-40">Previous</button>
            <span>Page {current} of {pages}</span>
            <button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)} className="rounded border border-[#c9d2e3] px-3 py-1 font-semibold disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>
    </div>
  )
}
