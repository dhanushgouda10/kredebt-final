import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Button, Card, CopyButton, SkeletonLines } from '../components/ui'
import { verifyCertificate, verifyCertificatePdf } from '../services/verificationService'
import { BLOCK_EXPLORER_URL } from '../contracts/skillChainConfig'
import { KredentMark } from '../components/brand/KredentLogo'

const ICONS = {
  check: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  ban: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M18.364 5.636a9 9 0 11-12.728 0 9 9 0 0112.728 0zM7 17L17 7" />
    </svg>
  ),
  cross: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  question: (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.79.382-1.451 1.05-1.451 1.827v.75M12 18h.008" />
    </svg>
  ),
}

/**
 * The verdict banner is the entire point of this page: someone has scanned a QR
 * code on a printed certificate and wants one answer. Each state therefore gets a
 * full-bleed solid colour band with a plain-English headline, rendered above
 * everything else — no breadcrumbs, page title or navigation ahead of it.
 */
const RESULT_META = {
  VERIFIED: {
    headline: 'Genuine certificate',
    band: 'bg-emerald-700',
    icon: ICONS.check,
  },
  REVOKED: {
    headline: 'Revoked by the institution',
    band: 'bg-amber-600',
    icon: ICONS.ban,
  },
  INVALID: {
    headline: 'Not a valid certificate',
    band: 'bg-red-700',
    icon: ICONS.cross,
  },
  UNAVAILABLE: {
    headline: 'Could not be checked right now',
    band: 'bg-slate-600',
    icon: ICONS.question,
  },
}

const PDF_RESULT_META = {
  AUTHENTIC: { label: 'This file matches the issued certificate', wrap: 'border-emerald-200 bg-emerald-50', iconWrap: 'bg-emerald-600', textColor: 'text-emerald-900', icon: ICONS.check },
  TAMPERED: { label: 'This file has been altered', wrap: 'border-red-200 bg-red-50', iconWrap: 'bg-red-700', textColor: 'text-red-900', icon: ICONS.cross },
  REVOKED: { label: 'This certificate has been revoked', wrap: 'border-amber-200 bg-amber-50', iconWrap: 'bg-amber-600', textColor: 'text-amber-900', icon: ICONS.ban },
}

function resultMeta(result) {
  return RESULT_META[result] ?? RESULT_META.UNAVAILABLE
}

function pdfMeta(result) {
  return PDF_RESULT_META[result] ?? PDF_RESULT_META.TAMPERED
}

/** One label/value row in the technical proof list. */
function ProofRow({ label, value, mono = false }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="flex-shrink-0 text-caption text-brand-muted/75">{label}</dt>
      <dd className={`flex min-w-0 items-center gap-2 sm:justify-end ${mono ? 'sm:text-right' : ''}`}>
        <span className={`min-w-0 ${mono ? 'break-all font-mono text-micro text-brand-ink' : 'text-caption font-medium text-brand-ink'}`}>
          {value}
        </span>
        {mono && <CopyButton value={String(value)} label={label} />}
      </dd>
    </div>
  )
}

export function VerifyResultPage() {
  const { certificateNumber } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [pdfFile, setPdfFile] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfResult, setPdfResult] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    verifyCertificate(certificateNumber)
      .then((result) => {
        setData(result)
        setError('')
      })
      .catch((err) => setError(err.message || 'Could not reach the verification service'))
      .finally(() => setLoading(false))
  }, [certificateNumber])

  const onPdfChange = (e) => {
    setPdfFile(e.target.files?.[0] ?? null)
    setPdfResult(null)
    setPdfError('')
  }

  const onPdfSubmit = async (e) => {
    e.preventDefault()
    if (!pdfFile) {
      setPdfError('Choose a PDF file to check.')
      return
    }
    setPdfLoading(true)
    setPdfError('')
    setPdfResult(null)
    try {
      const result = await verifyCertificatePdf(certificateNumber, pdfFile)
      setPdfResult(result)
    } catch (err) {
      setPdfError(err.message || 'Could not check this PDF right now.')
    } finally {
      setPdfLoading(false)
    }
  }

  const meta = data ? resultMeta(data.result) : null

  return (
    <div className="min-h-screen bg-surface-page pb-16">
      {/* ---- Verdict band: first thing rendered, full width, unmissable on a phone ---- */}
      {loading ? (
        <div className="bg-surface-sunken py-14" aria-busy="true">
          <div className="mx-auto max-w-3xl px-5 lg:px-10">
            <p className="text-caption font-medium text-brand-muted">Checking certificate {certificateNumber}…</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-slate-600 py-12">
          <div className="mx-auto max-w-3xl px-5 lg:px-10 text-white">
            <p className="text-h3 font-bold text-white">Could not be checked right now</p>
            <p className="text-body-l mt-3 text-white/90">{error}</p>
          </div>
        </div>
      ) : data ? (
        <div className={`${meta.band} py-12 sm:py-14`} role="status">
          <div className="mx-auto max-w-3xl px-5 text-white lg:px-10">
            <h1 className="text-h2 font-bold">{meta.headline}</h1>
            <p className="text-body-l mt-3 text-white/90">{data.message}</p>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-5 pt-8 lg:px-10">
        {/* Issuing authority — establishes who is making the above claim. */}
        <p className="mb-8 flex items-center gap-2.5 text-micro text-brand-muted/75">
          <KredentMark className="h-7 w-7" />
          <span>
            Checked against the on-chain credential record
            {data?.institution ? (
              <>
                {' '}issued by <span className="font-semibold text-brand-muted">{data.institution}</span>
              </>
            ) : null}
          </span>
        </p>

        {loading ? (
          <Card className="p-8">
            <SkeletonLines lines={5} />
          </Card>
        ) : data ? (
          <div className="space-y-6">
            {data.studentName && (
              <Card>
                <div className="border-b border-surface-line px-6 py-4">
                  <h2 className="text-body font-bold text-brand-primary">Certificate details</h2>
                </div>
                <dl className="divide-y divide-surface-line px-6">
                  <ProofRow label="Certificate number" value={data.certificateNumber} mono />
                  <ProofRow label="Awarded to" value={data.studentName} />
                  <ProofRow label="Degree" value={data.degreeName} />
                  <ProofRow label="Department" value={data.department} />
                  <ProofRow label="Institution" value={data.institution} />
                  <ProofRow label="Issued on" value={data.issuedAt?.slice(0, 10)} />
                </dl>
              </Card>
            )}

            {/* Blockchain data is supporting evidence, not the headline — collapsed by default. */}
            {data.tokenId != null && (
              <Card>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <h2 className="text-body font-bold text-brand-primary">Blockchain record</h2>
                      <p className="mt-0.5 text-caption text-brand-muted">
                        Permanently recorded and independently checkable.
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-caption font-semibold text-brand-accent">
                      <span className="group-open:hidden">Show proof</span>
                      <span className="hidden group-open:inline">Hide</span>
                    </span>
                  </summary>

                  <div className="border-t border-surface-line px-6 pb-6">
                    <dl className="divide-y divide-surface-line">
                      <ProofRow label="Network" value={data.network} />
                      <ProofRow label="Token ID" value={data.tokenId} />
                      <ProofRow label="Contract address" value={data.contractAddress} mono />
                      <ProofRow label="Certificate hash" value={data.certificateHash} mono />
                      <ProofRow label="Transaction hash" value={data.transactionHash} mono />
                    </dl>

                    {data.transactionHash && (
                      <a
                        href={`${BLOCK_EXPLORER_URL}/tx/${data.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-primary px-4 py-2 text-caption font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-white"
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

            {data.studentName && (
              <Card>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <h2 className="text-body font-bold text-brand-primary">Have a copy of the PDF?</h2>
                      <p className="mt-0.5 text-caption text-brand-muted">
                        Check whether the file you were sent has been altered.
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-caption font-semibold text-brand-accent">
                      <span className="group-open:hidden">Check file</span>
                      <span className="hidden group-open:inline">Hide</span>
                    </span>
                  </summary>

                  <div className="border-t border-surface-line px-6 py-6">
                    <form onSubmit={onPdfSubmit} className="space-y-4">
                      <label htmlFor="pdf-check" className="sr-only">
                        Certificate PDF file
                      </label>
                      <input
                        id="pdf-check"
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={onPdfChange}
                        className="block w-full text-caption text-brand-muted file:mr-4 file:rounded-lg file:border-0 file:bg-brand-primary file:px-4 file:py-2 file:text-caption file:font-semibold file:text-white hover:file:bg-brand-primary-deep"
                      />
                      {pdfError && <Alert variant="error">{pdfError}</Alert>}
                      <Button type="submit" variant="primary" loading={pdfLoading} disabled={pdfLoading}>
                        Check this file
                      </Button>
                    </form>

                    {pdfResult && (
                      <div className={`mt-5 rounded-lg border p-4 ${pdfMeta(pdfResult.result).wrap}`}>
                        <p className={`font-bold ${pdfMeta(pdfResult.result).textColor}`}>
                          {pdfMeta(pdfResult.result).label}
                        </p>
                        <p className={`text-body mt-1 ${pdfMeta(pdfResult.result).textColor}`}>{pdfResult.message}</p>
                      </div>
                    )}
                  </div>
                </details>
              </Card>
            )}
          </div>
        ) : null}

        <div className="mt-10 border-t border-surface-line pt-8">
          <Button to="/verify" variant="outline">
            Check another certificate
          </Button>
        </div>
      </div>
    </div>
  )
}
