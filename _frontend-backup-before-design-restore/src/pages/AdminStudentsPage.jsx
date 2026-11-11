import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CopyButton,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  PasswordInput,
  Select,
  SkeletonRow,
} from '../components/ui'
import {
  createStudent,
  getStudentCertificates,
  listStudents,
  updateStudent,
} from '../services/adminStudentService'
import { listDepartments } from '../services/departmentService'
import { normalizeEmail, validateEmail } from '../utils/email'

const PAGE_SIZE = 15

const EMPTY_CREATE_FORM = {
  fullName: '',
  usn: '',
  email: '',
  phone: '',
  department: '',
  password: '',
  confirmPassword: '',
}

const EMPTY_EDIT_FORM = { fullName: '', email: '', phone: '', department: '' }

// Certificate.status (backend enum) -> badge color, same mapping used on the Certificate Registry.
const STATUS_META = {
  PENDING_MINT: { label: 'Pending Mint', variant: 'warning' },
  MINTED: { label: 'Minted', variant: 'success' },
  MINT_FAILED: { label: 'Mint Failed', variant: 'danger' },
  REVOKED: { label: 'Revoked', variant: 'danger' },
}

function statusMeta(status) {
  return STATUS_META[status] ?? { label: status, variant: 'neutral' }
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function truncateWallet(address) {
  if (!address) return null
  return address.length > 14 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address
}

export function AdminStudentsPage() {
  const [departments, setDepartments] = useState([])
  const [departmentsError, setDepartmentsError] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')

  const [students, setStudents] = useState([])
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 0, totalElements: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  // Post-creation notice: whether the student's welcome email actually went out.
  const [notice, setNotice] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')

  const [editStudent, setEditStudent] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  const [detailStudent, setDetailStudent] = useState(null)
  const [detailCertificates, setDetailCertificates] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  // departments already starts as [] and departmentsError as '', so no synchronous setState is
  // needed here — only the async settle callbacks below.
  useEffect(() => {
    let cancelled = false
    listDepartments()
      .then((list) => {
        if (!cancelled) setDepartments(list)
      })
      .catch((err) => {
        if (!cancelled) setDepartmentsError(err.message || 'Could not load departments')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadStudents = (page = 0) => {
    setLoading(true)
    listStudents({ department: selectedDepartment, search: appliedSearch, page, size: PAGE_SIZE })
      .then((res) => {
        setStudents(res.content ?? [])
        setPageInfo({ page: res.page, totalPages: res.totalPages, totalElements: res.totalElements })
        setLoadError('')
      })
      .catch((err) => setLoadError(err.message || 'Could not load students'))
      .finally(() => setLoading(false))
  }

  // Re-fetches page 0 whenever the department or applied search changes. Deliberately does NOT
  // call the shared loadStudents() helper here (its first statement, setLoading(true), would be
  // a synchronous setState call inside the effect body) — every setState below happens inside a
  // .then/.catch/.finally callback instead, so the table simply swaps in the new department's
  // data once it arrives rather than flashing a skeleton state on every filter change.
  useEffect(() => {
    let cancelled = false
    listStudents({ department: selectedDepartment, search: appliedSearch, page: 0, size: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setStudents(res.content ?? [])
        setPageInfo({ page: res.page, totalPages: res.totalPages, totalElements: res.totalElements })
        setLoadError('')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load students')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDepartment, appliedSearch])

  const onSearchSubmit = (e) => {
    e.preventDefault()
    setAppliedSearch(searchInput.trim())
  }

  const selectDepartment = (code) => {
    setSelectedDepartment(code)
    setSearchInput('')
    setAppliedSearch('')
  }

  const openCreate = () => {
    setCreateForm({ ...EMPTY_CREATE_FORM, department: selectedDepartment || '' })
    setCreateError('')
    setCreateOpen(true)
  }

  const onCreateChange = (e) => {
    setCreateForm({ ...createForm, [e.target.name]: e.target.value })
  }

  const onCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateError('')

    // Institutional email rule — checked here for immediate feedback. The backend
    // re-validates on RegisterRequest, which is the actual enforcement point.
    const emailError = validateEmail(createForm.email)
    if (emailError) {
      setCreateError(emailError)
      return
    }

    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Passwords do not match.')
      return
    }
    setCreateSubmitting(true)
    try {
      const created = await createStudent({
        fullName: createForm.fullName.trim(),
        usn: createForm.usn.trim(),
        email: normalizeEmail(createForm.email),
        phone: createForm.phone.trim(),
        department: createForm.department,
        password: createForm.password,
      })
      setCreateOpen(false)
      // The account exists either way; the backend reports separately whether the
      // welcome email actually reached the student, so the admin knows whether to
      // follow up manually. `emailSent` is absent on older responses → treated as
      // "no notice to show" rather than a failure.
      if (created && created.emailSent === false) {
        setNotice(
          `${created.fullName ?? 'Student'} was created, but the notification email could not be delivered. Please inform them directly.`,
        )
      } else if (created && created.emailSent === true) {
        setNotice(`${created.fullName ?? 'Student'} was created and a notification email was sent.`)
      }
      listDepartments().then(setDepartments).catch(() => {})
      loadStudents(0)
    } catch (err) {
      setCreateError(err.message || 'Failed to create student')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const openEdit = (student) => {
    setEditStudent(student)
    setEditForm({
      fullName: student.fullName ?? '',
      email: student.email ?? '',
      phone: student.phone ?? '',
      department: student.department ?? '',
    })
    setEditError('')
  }

  const onEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value })
  }

  const onEditSubmit = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSubmitting(true)
    try {
      await updateStudent(editStudent.id, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        department: editForm.department,
      })
      setEditStudent(null)
      loadStudents(pageInfo.page)
    } catch (err) {
      setEditError(err.message || 'Failed to update student')
    } finally {
      setEditSubmitting(false)
    }
  }

  const openDetail = (student) => {
    setDetailStudent(student)
    setDetailCertificates([])
    setDetailError('')
    setDetailLoading(true)
    getStudentCertificates(student.id, { size: 20 })
      .then((res) => setDetailCertificates(res.content ?? []))
      .catch((err) => setDetailError(err.message || 'Could not load this student’s certificates'))
      .finally(() => setDetailLoading(false))
  }

  const departmentLabel = (code) => departments.find((d) => d.code === code)?.label ?? code

  return (
    <section className="min-h-screen bg-surface-page py-14 sm:py-16">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <PageHeader
          eyebrow="Administration"
          title="Students"
          subtitle="Student records, by department. Certificates are issued against these accounts."
        />

        {departmentsError && (
          <Alert variant="error" title="Could not load departments" className="mb-6">
            {departmentsError}
          </Alert>
        )}
        {loadError && (
          <Alert variant="error" title="Could not load students" className="mb-6">
            {loadError}
          </Alert>
        )}

        {notice && (
          <Alert
            variant={notice.includes('could not be delivered') ? 'warning' : 'success'}
            className="mb-6"
          >
            {notice}
          </Alert>
        )}

        {/* Department switcher */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectDepartment('')}
            className={`rounded-md border px-4 py-2.5 text-caption font-medium transition ${
              selectedDepartment === ''
                ? 'border-brand-primary bg-brand-primary text-white'
                : 'border-surface-line bg-surface-raised text-brand-muted hover:border-brand-primary/50'
            }`}
          >
            All Departments
          </button>
          {departments.map((dept) => (
            <button
              key={dept.code}
              type="button"
              onClick={() => selectDepartment(dept.code)}
              className={`rounded-md border px-4 py-2.5 text-caption font-medium transition ${
                selectedDepartment === dept.code
                  ? 'border-brand-accent bg-brand-accent text-white'
                  : 'border-surface-line bg-surface-raised text-brand-muted hover:border-brand-accent/50'
              }`}
            >
              {dept.code} <span className="opacity-70">({dept.studentCount})</span>
            </button>
          ))}
        </div>

        <div>
          <Card>
            <CardHeader
              title={selectedDepartment ? departmentLabel(selectedDepartment) : 'All Students'}
              subtitle={
                loading
                  ? 'Loading…'
                  : `${pageInfo.totalElements} student${pageInfo.totalElements === 1 ? '' : 's'}${
                      selectedDepartment ? ` in ${selectedDepartment}` : ' total'
                    }`
              }
              action={
                <Button variant="accent" onClick={openCreate}>
                  Add Student
                </Button>
              }
            />

            <div className="border-b border-surface-line p-6">
              <form onSubmit={onSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="Search by name, USN, or email…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="py-2.5"
                  containerClassName="flex-1"
                />
                <Button type="submit" variant="outline">
                  Search
                </Button>
                {appliedSearch && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchInput('')
                      setAppliedSearch('')
                    }}
                  >
                    Clear
                  </Button>
                )}
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-surface-line bg-surface-sunken">
                  <tr>
                    <th className="px-6 py-5 text-left text-label text-brand-muted">Student</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">USN</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Department</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Contact</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Wallet</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Joined</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-line">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} columns={7} />)
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          title="No students found"
                          description="Try a different search term or department, or add a new student account."
                        />
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr
                        key={student.id}
                        className="cursor-pointer transition-colors hover:bg-surface-sunken"
                        onClick={() => openDetail(student)}
                      >
                        <td className="px-6 py-5">
                          <p className="text-caption font-medium text-brand-ink">{student.fullName}</p>
                          <p className="text-micro text-brand-muted/75">{student.email}</p>
                        </td>
                        <td className="px-6 py-5">
                          <code className="rounded bg-surface-sunken px-2 py-1 font-mono text-micro text-brand-muted">{student.usn}</code>
                        </td>
                        <td className="px-6 py-5">
                          <Badge variant="info">{student.department}</Badge>
                        </td>
                        <td className="px-6 py-5 text-caption text-brand-muted">{student.phone || '—'}</td>
                        <td className="px-6 py-5">
                          {student.walletAddress ? (
                            <code
                              className="rounded bg-surface-sunken px-2 py-1 font-mono text-micro text-brand-muted"
                              title={student.walletAddress}
                            >
                              {truncateWallet(student.walletAddress)}
                            </code>
                          ) : (
                            <span className="text-caption text-brand-muted/75">Not assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-caption text-brand-muted">{formatDate(student.createdAt)}</td>
                        <td className="px-6 py-5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(student)
                            }}
                            className="rounded text-caption font-medium text-brand-accent transition-colors hover:text-orange-700"
                          >
                            Edit
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
                onPageChange={loadStudents}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Add Student modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Student">
        <form onSubmit={onCreateSubmit} className="space-y-6 p-6">
          <Input label="Full Name" name="fullName" value={createForm.fullName} onChange={onCreateChange} required />
          <Input
            label="USN"
            name="usn"
            value={createForm.usn}
            onChange={onCreateChange}
            required
            className="uppercase"
            placeholder="e.g. 1MJ21CS001"
          />
          <Input label="Email Address" type="email" name="email" value={createForm.email} onChange={onCreateChange} required />
          <Input label="Mobile Number" type="tel" name="phone" value={createForm.phone} onChange={onCreateChange} required />
          <Select label="Department" name="department" value={createForm.department} onChange={onCreateChange} required>
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.code} value={dept.code}>
                {dept.code} — {dept.label}
              </option>
            ))}
          </Select>
          <PasswordInput label="Password" name="password" value={createForm.password} onChange={onCreateChange} required />
          <PasswordInput
            label="Confirm Password"
            name="confirmPassword"
            value={createForm.confirmPassword}
            onChange={onCreateChange}
            required
          />

          {createError && <Alert variant="error">{createError}</Alert>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={createSubmitting}>
              {createSubmitting ? 'Creating…' : 'Create Student'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Student modal */}
      <Modal open={Boolean(editStudent)} onClose={() => setEditStudent(null)} title="Edit Student">
        {editStudent && (
          <form onSubmit={onEditSubmit} className="space-y-6 p-6">
            <Input label="USN" value={editStudent.usn} disabled hint="USN cannot be changed." />
            <Input label="Full Name" name="fullName" value={editForm.fullName} onChange={onEditChange} required />
            <Input label="Email Address" type="email" name="email" value={editForm.email} onChange={onEditChange} required />
            <Input label="Mobile Number" type="tel" name="phone" value={editForm.phone} onChange={onEditChange} required />
            <Select label="Department" name="department" value={editForm.department} onChange={onEditChange} required>
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.code} value={dept.code}>
                  {dept.code} — {dept.label}
                </option>
              ))}
            </Select>

            {editError && <Alert variant="error">{editError}</Alert>}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditStudent(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" loading={editSubmitting}>
                {editSubmitting ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Student Detail modal — department -> student -> certificates, no unnecessary navigation */}
      <Modal open={Boolean(detailStudent)} onClose={() => setDetailStudent(null)} title="Student Details">
        {detailStudent && (
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-caption text-brand-muted">Full Name</p>
                <p className="font-semibold text-brand-ink">{detailStudent.fullName}</p>
              </div>
              <div>
                <p className="text-caption text-brand-muted">USN</p>
                <p className="font-mono text-caption text-brand-ink">{detailStudent.usn}</p>
              </div>
              <div>
                <p className="text-caption text-brand-muted">Department</p>
                <Badge variant="info">{detailStudent.department}</Badge>
              </div>
              <div>
                <p className="text-caption text-brand-muted">Joined</p>
                <p className="font-semibold text-brand-ink">{formatDate(detailStudent.createdAt)}</p>
              </div>
              <div>
                <p className="text-caption text-brand-muted">Email</p>
                <p className="text-caption text-brand-ink">{detailStudent.email}</p>
              </div>
              <div>
                <p className="text-caption text-brand-muted">Phone</p>
                <p className="text-caption text-brand-ink">{detailStudent.phone || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-caption text-brand-muted">System-managed Wallet</p>
                <div className="flex items-start justify-between gap-2">
                  <p className="break-all font-mono text-micro text-brand-ink">{detailStudent.walletAddress || 'Not assigned'}</p>
                  {detailStudent.walletAddress && <CopyButton value={detailStudent.walletAddress} label="wallet address" />}
                </div>
              </div>
            </div>

            <div className="border-t border-surface-line pt-4">
              <p className="mb-3 text-caption font-semibold text-brand-muted">Certificates</p>
              {detailError && (
                <Alert variant="error" className="mb-3">
                  {detailError}
                </Alert>
              )}
              {detailLoading ? (
                <p className="text-caption text-brand-muted/75">Loading…</p>
              ) : detailCertificates.length === 0 ? (
                <p className="text-caption text-brand-muted/75">No certificates issued to this student yet.</p>
              ) : (
                <ul className="space-y-2">
                  {detailCertificates.map((cert) => (
                    <li
                      key={cert.id}
                      className="flex items-center justify-between rounded-lg border border-surface-line px-4 py-3"
                    >
                      <div>
                        <p className="text-caption font-medium text-brand-ink">{cert.degreeName}</p>
                        <code className="text-micro text-brand-muted/75">{cert.certificateNumber}</code>
                      </div>
                      <Badge variant={statusMeta(cert.status).variant}>{statusMeta(cert.status).label}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Button to="/admin/issue-degree" variant="outline" size="sm" className="mt-4">
                Issue a Certificate for this Student
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
