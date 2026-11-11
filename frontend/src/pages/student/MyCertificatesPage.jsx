import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, EmptyState, PageHeader, SkeletonLines } from '../../components/ui'
import { downloadCertificateFile, getMyCertificates } from '../../services/certificateService'
import { certificateStatusMeta } from '../../utils/certificateStatus'

/**
 * A graduate's certificate list.
 *
 * Was an eight-column table including Token ID and "Minted" date — a developer's
 * view of the data, and unusable on a phone without horizontal scrolling. A
 * student typically has one or two records here, so a table was the wrong
 * primitive entirely: this is now a list of records, with the on-chain
 * identifiers left to the detail page where they can be explained.
 */
export function MyCertificatesPage() {
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    getMyCertificates({ size: 100 })
      .then((page) => {
        setCertificates(page.content ?? [])
        setLoadError('')
      })
      .catch((err) => setLoadError(err.message || 'Could not load your certificates'))
      .finally(() => setLoading(false))
  }, [])

  const handleDownload = async (cert) => {
    setActionError('')
    setDownloadingId(cert.id)
    try {
      await downloadCertificateFile(cert.id, `${cert.certificateNumber}.pdf`)
    } catch (err) {
      setActionError(err.message || 'Failed to download certificate')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section className="min-h-screen bg-surface-page py-10 sm:py-12">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-10">
        <PageHeader
          eyebrow="Student portal"
          title="My certificates"
          subtitle="Certificates issued to you by your institution."
        />

        {loadError && (
          <Alert variant="error" title="Could not load certificates" className="mb-6">
            {loadError}
          </Alert>
        )}
        {actionError && (
          <Alert variant="error" title="Download failed" className="mb-6">
            {actionError}
          </Alert>
        )}

        {loading ? (
          <Card className="p-8">
            <SkeletonLines lines={5} />
          </Card>
        ) : certificates.length === 0 ? (
          <Card>
            <EmptyState
              title="No certificates yet"
              description="Once the college issues you a certificate, it will show up here."
            />
          </Card>
        ) : (
          <ul className="space-y-4">
            {certificates.map((cert) => {
              const meta = certificateStatusMeta(cert.status)
              return (
                <li key={cert.id}>
                  <Card className="p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="font-serif text-body-l font-bold text-brand-primary">{cert.degreeName}</h2>

                        <p className="mt-1 font-mono text-micro text-brand-muted/75">{cert.certificateNumber}</p>

                        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-caption">
                          <div className="flex gap-2">
                            <dt className="text-brand-muted/75">Department</dt>
                            <dd className="font-medium text-brand-ink">{cert.department}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-brand-muted/75">Year</dt>
                            <dd className="font-medium text-brand-ink">{cert.yearOfCompletion}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-brand-muted/75">Issued</dt>
                            <dd className="font-medium text-brand-ink">{cert.issuedAt?.slice(0, 10) ?? '—'}</dd>
                          </div>
                        </dl>

                        {meta.plain && <p className="mt-4 text-caption text-brand-muted">{meta.plain}</p>}
                      </div>

                      <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
                        {cert.fileAvailable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(cert)}
                            loading={downloadingId === cert.id}
                          >
                            Download
                          </Button>
                        )}
                        <Link
                          to={`/student/certificates/${cert.id}`}
                          className="text-caption font-semibold text-brand-accent hover:underline"
                        >
                          View details
                        </Link>
                      </div>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
