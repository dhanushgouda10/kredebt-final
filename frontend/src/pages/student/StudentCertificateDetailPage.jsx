import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Alert,
  BackButton,
  Button,
  Card,
  CopyButton,
  PageHeader,
  SkeletonLines,
} from '../../components/ui'
import { downloadCertificateFile, getCertificateById } from '../../services/certificateService'
import { BLOCK_EXPLORER_URL, NETWORK_NAME } from '../../contracts/skillChainConfig'
import { certificateStatusMeta } from '../../utils/certificateStatus'

/** A plain label/value pair. */
function Field({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-micro font-semibold uppercase tracking-wide text-mvj-muted/75">{label}</dt>
      <dd className={`mt-1 font-semibold text-mvj-ink ${mono ? 'break-all font-mono text-micro' : 'text-caption'}`}>
        {value || '—'}
      </dd>
    </div>
  )
}

/** A technical identifier row, with a copy affordance. */
function TechnicalRow({ label, value, copyable = true }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="flex-shrink-0 text-caption text-mvj-muted/75">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 sm:justify-end">
        <span className="min-w-0 break-all font-mono text-micro text-mvj-ink">{value}</span>
        {copyable && <CopyButton value={String(value)} label={label} />}
      </dd>
    </div>
  )
}

/**
 * A single certificate, as seen by the graduate who owns it.
 *
 * Information is grouped so that a non-technical reader is never asked to parse
 * a hash to answer a simple question. Order is deliberate: status first (is it
 * valid?), then the certificate itself, then the document, and only then the
 * on-chain identifiers — which stay collapsed behind a disclosure, because a
 * student looking for their download button should not have to scroll past a
 * contract address to reach it.
 */
export function StudentCertificateDetailPage() {
  const { id } = useParams()
  const [cert, setCert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    getCertificateById(id)
      .then((data) => {
        setCert(data)
        setLoadError('')
      })
      .catch((err) => setLoadError(err.message || 'Could not load this certificate'))
      .finally(() => setLoading(false))
  }, [id])

  const handleDownload = async () => {
    if (!cert) return
    setDownloadError('')
    setDownloading(true)
    try {
      await downloadCertificateFile(cert.id, `${cert.certificateNumber}.pdf`)
    } catch (err) {
      setDownloadError(err.message || 'Failed to download certificate')
    } finally {
      setDownloading(false)
    }
  }

  const meta = cert ? certificateStatusMeta(cert.status) : null
  const hasChainRecord = cert?.status === 'MINTED' && cert?.tokenId != null

  return (
    <section className="min-h-screen bg-surface-page py-10 sm:py-12">
      <div className="mx-auto max-w-3xl px-5 lg:px-10">
        <BackButton label="Back to my certificates" fallbackTo="/student/certificates" className="mb-6" />

        <PageHeader
          eyebrow="Certificate"
          title={cert?.degreeName ?? 'Certificate details'}
          subtitle={cert?.certificateNumber}
        />

        {loadError && (
          <Alert variant="error" title="Could not load certificate" className="mb-6">
            {loadError}
          </Alert>
        )}

        {loading ? (
          <Card className="p-8">
            <SkeletonLines lines={6} />
          </Card>
        ) : cert ? (
          <div className="space-y-6">
            {/* 1 — Status, in plain language. */}
            <Card className="p-6">
              <p className="text-h3 text-kredent-navy">Status</p>
              {meta.plain && <p className="mt-2 text-body leading-relaxed text-mvj-muted">{meta.plain}</p>}
              {cert.status === 'REVOKED' && cert.revokedReason && (
                <p className="mt-2 text-caption text-mvj-muted">Reason given: {cert.revokedReason}</p>
              )}
            </Card>

            {/* 2 — Who it belongs to and what it is. */}
            <Card>
              <div className="border-b border-surface-line px-6 py-4">
                <h2 className="text-body font-bold text-kredent-navy">Certificate information</h2>
              </div>
              <dl className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
                <Field label="Awarded to" value={cert.studentName} />
                <Field label="USN" value={cert.studentUsn} mono />
                <Field label="Degree" value={cert.degreeName} />
                <Field label="Department" value={cert.department} />
                <Field label="Year of completion" value={cert.yearOfCompletion} />
                <Field label="Issued on" value={cert.issuedAt?.slice(0, 10)} />
              </dl>
            </Card>

            {/* 3 — The document itself. */}
            <Card>
              <div className="border-b border-surface-line px-6 py-4">
                <h2 className="text-body font-bold text-kredent-navy">Your document</h2>
              </div>
              <div className="p-6">
                {downloadError && (
                  <Alert variant="error" className="mb-4">
                    {downloadError}
                  </Alert>
                )}
                {cert.fileAvailable ? (
                  <>
                    <p className="mb-4 text-caption text-mvj-muted">
                      The PDF carries a QR code that anyone can scan to confirm it is genuine.
                    </p>
                    <Button variant="primary" onClick={handleDownload} loading={downloading}>
                      Download certificate
                    </Button>
                  </>
                ) : (
                  <p className="text-caption text-mvj-muted/75">The certificate PDF has not been uploaded yet.</p>
                )}
              </div>
            </Card>

            {/* 4 — Technical proof, collapsed. */}
            {(hasChainRecord || cert.fileHash) && (
              <Card>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <h2 className="text-body font-bold text-kredent-navy">Verification details</h2>
                      <p className="mt-0.5 text-caption text-mvj-muted">
                        Technical identifiers, if you need to share proof.
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-caption font-semibold text-kredent-accent">
                      <span className="group-open:hidden">Show</span>
                      <span className="hidden group-open:inline">Hide</span>
                    </span>
                  </summary>

                  <div className="border-t border-surface-line px-6 pb-6">
                    <dl className="divide-y divide-surface-line">
                      <TechnicalRow label="Certificate hash" value={cert.fileHash} />
                      {hasChainRecord && (
                        <>
                          <TechnicalRow label="Network" value={NETWORK_NAME} copyable={false} />
                          <TechnicalRow label="Token ID" value={cert.tokenId} />
                          <TechnicalRow label="Contract address" value={cert.contractAddress} />
                          <TechnicalRow label="Transaction hash" value={cert.txHash} />
                          <TechnicalRow
                            label="Recorded at"
                            value={cert.mintedAt?.slice(0, 19).replace('T', ' ')}
                            copyable={false}
                          />
                        </>
                      )}
                    </dl>

                    {cert.txHash && (
                      <a
                        href={`${BLOCK_EXPLORER_URL}/tx/${cert.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-kredent-navy px-4 py-2 text-caption font-semibold text-kredent-navy transition hover:bg-kredent-navy hover:text-white"
                      >
                        View on the public block explorer
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </details>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
