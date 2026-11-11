import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, EmptyState, PageHeader, SkeletonLines } from '../../components/ui'
import { getMyCertificates } from '../../services/certificateService'
import { getOwnProfile } from '../../services/studentService'
import { certificateStatusMeta } from '../../utils/certificateStatus'

export function StudentDashboardPage() {
  const [profile, setProfile] = useState(null)
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getOwnProfile(), getMyCertificates({ size: 100 })])
      .then(([profileData, certPage]) => {
        setProfile(profileData)
        setCertificates(certPage.content ?? [])
        setError('')
      })
      .catch((err) => setError(err.message || 'Could not load your dashboard'))
      .finally(() => setLoading(false))
  }, [])

  const recentCertificates = [...certificates]
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
    .slice(0, 5)

  const identityFields = [
    { label: 'College', value: profile?.institutionName },
    { label: 'USN', value: profile?.usn, mono: true },
    { label: 'Department', value: profile?.department },
    { label: 'Email', value: profile?.email },
  ]

  return (
    <section className="min-h-screen bg-surface-page section-padding !pt-10 !pb-12">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-10">
        <PageHeader
          eyebrow="Student portal"
          title={profile ? `Welcome, ${profile.fullName}` : 'Welcome'}
          subtitle="Your degree certificates issued by your institution."
        />

        {error && (
          <Alert variant="error" title="Could not load dashboard" className="mb-6">
            {error}
          </Alert>
        )}

        {loading ? (
          <Card className="p-8">
            <SkeletonLines lines={5} />
          </Card>
        ) : (
          <div className="space-y-8">
            {profile && (
              <dl className="grid grid-cols-1 gap-6 border-b border-surface-line pb-8 sm:grid-cols-3">
                {identityFields.map((field) => (
                  <div key={field.label}>
                    <dt className="text-label text-brand-muted">{field.label}</dt>
                    <dd className={`mt-2 break-words font-semibold text-brand-ink ${field.mono ? 'font-mono text-body' : 'text-body'}`}>
                      {field.value || '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-h3 font-bold text-brand-primary">Your certificates</h2>
                {certificates.length > 0 && (
                  <Link to="/student/certificates" className="text-caption font-semibold text-brand-danger underline underline-offset-2 hover:text-brand-primary">
                    View all
                  </Link>
                )}
              </div>

              {recentCertificates.length === 0 ? (
                <EmptyState
                  title="No certificates yet"
                  description="Certificates issued to you by the college will appear here."
                />
              ) : (
                <ul className="divide-y divide-surface-line border-y border-surface-line">
                  {recentCertificates.map((cert) => {
                    const meta = certificateStatusMeta(cert.status)
                    return (
                      <li key={cert.id}>
                        <Link
                          to={`/student/certificates/${cert.id}`}
                          className="flex flex-col gap-2 py-5 transition-colors hover:bg-surface-band sm:flex-row sm:items-center sm:justify-between sm:px-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-brand-ink">{cert.degreeName}</p>
                            <p className="mt-0.5 truncate text-body text-brand-muted">
                              {cert.department} · {cert.yearOfCompletion}
                            </p>
                            {cert.status !== 'MINTED' && meta.plain && (
                              <p className="mt-1 text-caption text-brand-muted">{meta.plain}</p>
                            )}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
