import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Badge, Button, Card, CardHeader, Input, PageHeader, Select } from '../components/ui'
import { createCertificate, deleteCertificateDraft, generateCertificateFile, openSampleCertificate } from '../services/certificateService'
import { listDepartments } from '../services/departmentService'
import { listStudents } from '../services/adminStudentService'

// Generous upper bound for a single department's roster in this plain <select> — not a real
// pagination limit, just large enough that no realistic department's student count gets
// truncated. The query itself is still server-side and department-scoped (StudentService
// .listStudentsByDepartment via GET /api/admin/students?department=...), never an unfiltered
// fetch-everything-then-filter-in-the-browser.
const STUDENT_LIST_SIZE = 500

export function IssueDegreePage() {
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState('')

  const [departments, setDepartments] = useState([])
  const [departmentsError, setDepartmentsError] = useState('')

  const [formData, setFormData] = useState({
    studentId: '',
    degreeName: '',
    yearOfCompletion: '',
  })

  const [isIssuing, setIsIssuing] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [error, setError] = useState('')
  const [issuedCertificate, setIssuedCertificate] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    listDepartments()
      .then((list) => {
        if (!cancelled) {
          setDepartments(list)
          setDepartmentsError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setDepartmentsError(err.message || 'Could not load departments')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Loads ONLY the students belonging to the selected department, via the existing server-side
  // department filter (GET /api/admin/students?department=...) — never an unfiltered fetch
  // filtered client-side. Re-runs every time the department changes; with no department selected
  // there is nothing to fetch, so the student list is just cleared.
  //
  // Every setState call here happens inside a .then()/.catch()/.finally() callback rather than
  // synchronously in the effect body, to satisfy react-hooks/set-state-in-effect — the same
  // pattern used by the department-driven effects on the Students and Certificate Registry pages.
  // One accepted trade-off from that pattern: switching departments doesn't show a fresh loading
  // skeleton on frame one, the list just swaps in once the fetch resolves.
  useEffect(() => {
    let cancelled = false

    if (!selectedDepartment) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setStudents([])
          setStudentsError('')
          setStudentsLoading(false)
        }
      })
      return () => {
        cancelled = true
      }
    }

    Promise.resolve()
      .then(() => {
        if (!cancelled) setStudentsLoading(true)
      })
      .then(() => listStudents({ department: selectedDepartment, size: STUDENT_LIST_SIZE }))
      .then((page) => {
        if (!cancelled) {
          setStudents(page.content ?? [])
          setStudentsError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setStudentsError(err.message || 'Could not load students for this department')
      })
      .finally(() => {
        if (!cancelled) setStudentsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedDepartment])

  const selectedStudent = students.find((s) => String(s.id) === String(formData.studentId)) ?? null
  const departmentLabel = (code) => departments.find((d) => d.code === code)?.label ?? code
  const noStudentsInDepartment =
    Boolean(selectedDepartment) && !studentsLoading && !studentsError && students.length === 0

  const handleDepartmentChange = (e) => {
    // Selecting a new department invalidates whatever student was previously chosen (it very
    // likely doesn't belong to the new department at all) — clear it so the form can never submit
    // a student/department combination that doesn't match what's shown.
    setSelectedDepartment(e.target.value)
    setFormData((prev) => ({ ...prev, studentId: '' }))
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handlePreview = async () => {
    setError('')
    setIsPreviewing(true)
    try {
      await openSampleCertificate()
    } catch (err) {
      setError(err.message || 'Could not open the sample certificate')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIssuedCertificate(null)

    setIsIssuing(true)
    let created = null
    try {
      // Step 1: create the certificate metadata row. Department is intentionally NOT sent here —
      // the backend always derives it from the selected student's own department
      // (CertificateService.createMetadata), so a certificate can never disagree with the
      // student it belongs to.
      const certificate = (created = await createCertificate({
        studentId: Number(formData.studentId),
        degreeName: formData.degreeName,
        yearOfCompletion: Number(formData.yearOfCompletion),
      }))

      // Step 2: the backend generates the standard certificate (college name, student details,
      // verification QR), hashes it (SHA-256) and stores it in Supabase Storage.
      const withFile = await generateCertificateFile(certificate.id)

      setIssuedCertificate(withFile)
      setFormData({ studentId: '', degreeName: '', yearOfCompletion: '' })
      e.target.reset()
    } catch (err) {
      // If the record was created but its PDF could not be generated, remove the empty record so
      // retrying does not leave a duplicate behind.
      if (created) {
        try {
          await deleteCertificateDraft(created.id)
        } catch {
          // best effort — the admin can still delete it from Issued Certificates
        }
      }
      setError(err.message || 'Failed to issue certificate')
    } finally {
      setIsIssuing(false)
    }
  }

  return (
    <section className="min-h-screen bg-surface-page py-14 sm:py-16">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <PageHeader
          eyebrow="Administration"
          title="Issue a degree"
          subtitle="Create the certificate record. The certificate is generated automatically."
        />

        <div className="mx-auto max-w-4xl">
          <div>
            <Card>
              <CardHeader
                title="Issue Degree Credential"
                subtitle="Select the student and degree details. The certificate PDF is generated automatically."
              />

              <div className="p-6 sm:p-8">
                {studentsError && (
                  <Alert variant="error" title="Could not load students" className="mb-6">
                    {studentsError}
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
                    <Select
                      label="Department"
                      name="department"
                      value={selectedDepartment}
                      onChange={handleDepartmentChange}
                      required
                      containerClassName="md:col-span-2"
                      disabled={departments.length === 0 && !departmentsError}
                      hint={departmentsError ? 'Could not load departments — please refresh.' : 'Choose a department to load its students below.'}
                    >
                      <option value="">{departments.length === 0 && !departmentsError ? 'Loading departments…' : 'Select Department'}</option>
                      {departments.map((dept) => (
                        <option key={dept.code} value={dept.code}>
                          {dept.code} — {dept.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Student"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleInputChange}
                      required
                      containerClassName="md:col-span-2"
                      disabled={!selectedDepartment || studentsLoading || noStudentsInDepartment}
                    >
                      <option value="">
                        {!selectedDepartment
                          ? 'Select a department first'
                          : studentsLoading
                            ? 'Loading students…'
                            : noStudentsInDepartment
                              ? 'No students registered in this department yet'
                              : 'Select Student'}
                      </option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.fullName} — {student.usn}
                        </option>
                      ))}
                    </Select>

                    <div>
                      <p className="mb-1.5 text-caption font-medium text-brand-muted">Confirmed Department</p>
                      <div className="flex h-[46px] items-center rounded-lg border border-surface-line bg-surface-sunken px-4">
                        {selectedStudent ? (
                          <Badge variant="info">
                            {selectedStudent.department} — {departmentLabel(selectedStudent.department)}
                          </Badge>
                        ) : (
                          <span className="text-caption text-brand-muted/75">Select a student to confirm department</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-micro text-brand-muted/75">Always taken from the student's own record — cannot be changed here.</p>
                    </div>

                    <Input
                      label="Year of Completion"
                      type="number"
                      name="yearOfCompletion"
                      value={formData.yearOfCompletion}
                      onChange={handleInputChange}
                      placeholder="e.g., 2025"
                      min="2000"
                      max="2100"
                      required
                    />

                    <Select label="Degree Program" name="degreeName" value={formData.degreeName} onChange={handleInputChange} required containerClassName="md:col-span-2">
                      <option value="">Select Degree</option>
                      <option value="B.E. Computer Science and Engineering">B.E. Computer Science and Engineering</option>
                      <option value="B.E. Electronics and Communication Engineering">
                        B.E. Electronics and Communication Engineering
                      </option>
                      <option value="B.E. Mechanical Engineering">B.E. Mechanical Engineering</option>
                      <option value="B.E. Civil Engineering">B.E. Civil Engineering</option>
                      <option value="B.E. Electrical and Electronics Engineering">
                        B.E. Electrical and Electronics Engineering
                      </option>
                    </Select>
                  </div>

                  {error && (
                    <Alert variant="error" title="Something went wrong">
                      {error}
                    </Alert>
                  )}

                  <div className="flex flex-col gap-4 border-t border-surface-line pt-6 sm:flex-row">
                    <Button type="submit" variant="primary" size="lg" loading={isIssuing} className="flex-1">
                      {isIssuing ? (
                        'Issuing…'
                      ) : (
                        <>
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Issue Certificate
                        </>
                      )}
                    </Button>

                    <Button type="button" variant="outline" size="lg" loading={isPreviewing} onClick={handlePreview}>
                      Preview certificate
                    </Button>
                    <Button type="button" variant="outline" size="lg" onClick={() => navigate('/admin/issued-certificates')}>
                      View Certificates
                    </Button>
                  </div>
                </form>

                {/* Success Message */}
                {issuedCertificate && (
                  <div className="mt-6">
                    <Alert variant="success" title="Certificate Record Created">
                      <div className="mt-2 space-y-3 text-caption">
                        <p className="text-green-700">
                          The certificate for <span className="font-medium">{issuedCertificate.studentName}</span> (
                          {issuedCertificate.studentUsn}) has been created and the certificate PDF has been generated and secured — a
                          verification QR code was generated and stamped onto the document.
                        </p>
                        <p className="text-green-700">
                          <span className="font-medium">Certificate Number:</span> {issuedCertificate.certificateNumber}
                        </p>
                        <p className="text-green-700">
                          This record still needs to be issued on the blockchain before it's final. Go to{' '}
                          <span className="font-medium">Issued Certificates</span> to complete that step.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/admin/issued-certificates')}
                        >
                          Go to Issued Certificates
                        </Button>
                      </div>
                    </Alert>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
