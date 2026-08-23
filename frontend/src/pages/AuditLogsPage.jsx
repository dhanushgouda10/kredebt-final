import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  SkeletonRow,
} from '../components/ui'
import { listAuditLogs } from '../services/auditLogService'
import { listDepartments } from '../services/departmentService'

const PAGE_SIZE = 25

// AuditLog.action (backend, a free-form string written by whichever service call recorded the
// event — see AuditLogService.record's call sites) -> how it should read/color in this admin UI.
// Also doubles as the fixed set of options in the Action filter dropdown, since these are the
// only actions the backend actually writes today.
const ACTION_META = {
  CERTIFICATE_METADATA_ISSUED: { label: 'Certificate Issued', variant: 'info' },
  CERTIFICATE_FILE_UPLOADED: { label: 'PDF Uploaded', variant: 'neutral' },
  CERTIFICATE_METADATA_DELETED: { label: 'Certificate Deleted', variant: 'danger' },
  CERTIFICATE_STATUS_UPDATED: { label: 'Status Updated', variant: 'warning' },
  CERTIFICATE_BLOCKCHAIN_ISSUED: { label: 'Blockchain Issued', variant: 'success' },
  CERTIFICATE_BLOCKCHAIN_REVOKED: { label: 'Blockchain Revoked', variant: 'danger' },
  STUDENT_CREATED: { label: 'Student Created', variant: 'info' },
  STUDENT_UPDATED: { label: 'Student Updated', variant: 'neutral' },
}

function actionMeta(action) {
  return ACTION_META[action] ?? { label: action, variant: 'neutral' }
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateHash(hash) {
  if (!hash) return null
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash
}

export function AuditLogsPage() {
  const [departments, setDepartments] = useState([])

  const [logs, setLogs] = useState([])
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 0, totalElements: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  useEffect(() => {
    let cancelled = false
    listDepartments()
      .then((list) => {
        if (!cancelled) setDepartments(list)
      })
      .catch(() => {
        // Non-fatal — the department filter just won't render its options.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadLogs = (page = 0) => {
    setLoading(true)
    listAuditLogs({
      search: appliedSearch,
      action: actionFilter,
      department: departmentFilter,
      page,
      size: PAGE_SIZE,
    })
      .then((res) => {
        setLogs(res.content ?? [])
        setPageInfo({ page: res.page, totalPages: res.totalPages, totalElements: res.totalElements })
        setLoadError('')
      })
      .catch((err) => setLoadError(err.message || 'Could not load audit logs'))
      .finally(() => setLoading(false))
  }

  // Re-fetches page 0 whenever a filter changes. Every setState call happens inside a
  // .then/.catch/.finally callback (never synchronously in the effect body) to satisfy
  // react-hooks/set-state-in-effect — same pattern used on the Students and Certificate Registry
  // pages.
  useEffect(() => {
    let cancelled = false
    listAuditLogs({
      search: appliedSearch,
      action: actionFilter,
      department: departmentFilter,
      page: 0,
      size: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        setLogs(res.content ?? [])
        setPageInfo({ page: res.page, totalPages: res.totalPages, totalElements: res.totalElements })
        setLoadError('')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load audit logs')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appliedSearch, actionFilter, departmentFilter])

  const onSearchSubmit = (e) => {
    e.preventDefault()
    setAppliedSearch(searchInput.trim())
  }

  return (
    <section className="min-h-screen bg-surface-page py-14 sm:py-16">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <PageHeader
          eyebrow="Administration"
          title="Audit log"
          subtitle="Read-only record of certificate issuance, revocation, uploads and blockchain events."
        />

        {loadError && (
          <Alert variant="error" title="Could not load audit logs" className="mb-6">
            {loadError}
          </Alert>
        )}

        <div>
          <Card>
          <CardHeader
            title="Activity Log"
            subtitle={loading ? 'Loading…' : `${pageInfo.totalElements} entr${pageInfo.totalElements === 1 ? 'y' : 'ies'}`}
          />

          {/* Search and Filter */}
          <div className="border-b border-surface-line p-6">
            <form onSubmit={onSearchSubmit} className="flex flex-col gap-4 lg:flex-row">
              <div className="flex-1">
                <Input
                  placeholder="Search by certificate number, USN, or action..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="py-2.5"
                />
              </div>
              <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="py-2.5 lg:w-48">
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.code} value={dept.code}>
                    {dept.code}
                  </option>
                ))}
              </Select>
              <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="py-2.5 lg:w-64">
                <option value="">All Actions</option>
                {Object.entries(ACTION_META).map(([action, meta]) => (
                  <option key={action} value={action}>
                    {meta.label}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="outline">
                Search
              </Button>
            </form>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-surface-line bg-surface-sunken">
                <tr>
                  <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-mvj-muted">Date / Time</th>
                  <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-mvj-muted">Action</th>
                  <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-mvj-muted">Certificate</th>
                  <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-mvj-muted">Student</th>
                  <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-mvj-muted">Department</th>
                  <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-mvj-muted">Performed By</th>
                  <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-mvj-muted">Tx Hash</th>
                  <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-mvj-muted">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-line">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} columns={8} />)
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        title="No audit log entries found"
                        description="Try a different search term, action, or department filter."
                      />
                    </td>
                  </tr>
                ) : (
                  logs.map((entry) => (
                    <tr
                      key={entry.id}
                      className="transition-colors hover:bg-surface-sunken"
                    >
                      <td className="px-6 py-5 text-caption text-mvj-muted">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-6 py-5">
                        <Badge variant={actionMeta(entry.action).variant}>{actionMeta(entry.action).label}</Badge>
                      </td>
                      <td className="px-6 py-5">
                        {entry.certificateNumber ? (
                          <code className="rounded bg-surface-sunken px-2 py-1 font-mono text-micro text-mvj-muted">
                            {entry.certificateNumber}
                          </code>
                        ) : (
                          <span className="text-caption text-mvj-muted/75">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {entry.studentName || entry.studentUsn ? (
                          <div>
                            {entry.studentName && <p className="text-caption font-medium text-mvj-ink">{entry.studentName}</p>}
                            {entry.studentUsn && <p className="text-micro text-mvj-muted/75">{entry.studentUsn}</p>}
                          </div>
                        ) : (
                          <span className="text-caption text-mvj-muted/75">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {entry.department ? (
                          <Badge variant="info">{entry.department}</Badge>
                        ) : (
                          <span className="text-caption text-mvj-muted/75">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-caption text-mvj-muted">
                        {entry.actorName || '—'}
                        {entry.actorType && <span className="ml-1.5 text-micro text-mvj-muted/75">({entry.actorType})</span>}
                      </td>
                      <td className="px-6 py-5">
                        {entry.transactionHash ? (
                          <code className="rounded bg-surface-sunken px-2 py-1 font-mono text-micro text-mvj-muted" title={entry.transactionHash}>
                            {truncateHash(entry.transactionHash)}
                          </code>
                        ) : (
                          <span className="text-caption text-mvj-muted/75">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <button
                          onClick={() => setSelectedLog(entry)}
                          className="rounded text-caption font-medium text-blue-600 transition-colors hover:text-blue-800"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && (
            <Pagination
              page={pageInfo.page}
              totalPages={pageInfo.totalPages}
              totalElements={pageInfo.totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={loadLogs}
            />
          )}
        </Card>
      </div>

      {/* Entry Detail Modal */}
      <Modal open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} title="Audit Log Entry">
        {selectedLog && (
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-caption text-mvj-muted">Date / Time</p>
                <p className="font-semibold text-mvj-ink">{formatDateTime(selectedLog.createdAt)}</p>
              </div>
              <div>
                <p className="mb-1 text-caption text-mvj-muted">Action</p>
                <Badge variant={actionMeta(selectedLog.action).variant}>{actionMeta(selectedLog.action).label}</Badge>
              </div>
              {selectedLog.certificateNumber && (
                <div>
                  <p className="text-caption text-mvj-muted">Certificate Number</p>
                  <p className="font-mono text-caption text-mvj-ink">{selectedLog.certificateNumber}</p>
                </div>
              )}
              {(selectedLog.studentName || selectedLog.studentUsn) && (
                <div>
                  <p className="text-caption text-mvj-muted">Student</p>
                  <p className="font-semibold text-mvj-ink">
                    {selectedLog.studentName} {selectedLog.studentUsn && `(${selectedLog.studentUsn})`}
                  </p>
                </div>
              )}
              {selectedLog.department && (
                <div>
                  <p className="text-caption text-mvj-muted">Department</p>
                  <p className="font-semibold text-mvj-ink">{selectedLog.department}</p>
                </div>
              )}
              <div>
                <p className="text-caption text-mvj-muted">Performed By</p>
                <p className="font-semibold text-mvj-ink">
                  {selectedLog.actorName || '—'} <span className="text-caption font-normal text-mvj-muted/75">({selectedLog.actorType})</span>
                </p>
              </div>
              {selectedLog.transactionHash && (
                <div className="md:col-span-2">
                  <p className="mb-1 text-caption text-mvj-muted">Transaction Hash</p>
                  <p className="break-all rounded bg-surface-sunken p-2 font-mono text-micro text-mvj-ink">{selectedLog.transactionHash}</p>
                </div>
              )}
            </div>

            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div>
                <p className="mb-2 text-caption font-semibold text-mvj-muted">Details</p>
                <div className="space-y-1.5 rounded-lg bg-surface-sunken p-4">
                  {Object.entries(selectedLog.details).map(([key, value]) => (
                    <div key={key} className="flex flex-wrap justify-between gap-2 text-caption">
                      <span className="text-mvj-muted/75">{key}</span>
                      <span className="break-all text-right font-mono text-micro text-mvj-ink">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </Modal>
      </div>
    </section>
  )
}
