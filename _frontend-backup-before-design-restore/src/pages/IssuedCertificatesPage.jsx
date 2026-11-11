import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Select,
  SkeletonRow,
  SkeletonStatCard,
  StatCard,
} from '../components/ui'
import {
  downloadCertificateFile,
  issueCertificateBlockchain,
  listCertificates,
  revokeCertificateBlockchain,
  updateCertificateStatus,
} from '../services/certificateService'
import { issueCredentialOnChain, revokeCredentialOnChain, onAccountsChanged } from '../services/blockchainService'
import { listDepartments, getDepartmentSummary } from '../services/departmentService'
import { BLOCK_EXPLORER_URL } from '../contracts/skillChainConfig'
import { certificateStatusMeta } from '../utils/certificateStatus'

const PAGE_SIZE = 20

// Status presentation now lives in utils/certificateStatus so the admin and
// student views of the same record can never drift apart.
const statusMeta = certificateStatusMeta

// Reasonable graduation-year filter options — not stored data, just the range of years the year
// picker offers; actual filtering only ever matches real certificate.yearOfCompletion values.
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + 1 - i)

export function IssuedCertificatesPage() {
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [deptSummary, setDeptSummary] = useState(null)
  const [deptSummaryError, setDeptSummaryError] = useState('')

  const [certificates, setCertificates] = useState([])
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 0, totalElements: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [blockchainBusyId, setBlockchainBusyId] = useState(null)

  // Manual reconciliation modal — shown when a certificate is confirmed already-minted on-chain
  // (certificateIdToTokenId != 0) but the original transaction hash couldn't be auto-recovered.
  const [reconcileTarget, setReconcileTarget] = useState(null) // { cert, tokenId, contractAddress, message }
  const [reconcileHash, setReconcileHash] = useState('')
  const [reconcileError, setReconcileError] = useState('')
  const [reconcileSubmitting, setReconcileSubmitting] = useState(false)

  const navigate = useNavigate()

  // departments starts as [] so no synchronous setState is needed for the happy path — only the
  // async settle callbacks below.
  useEffect(() => {
    let cancelled = false
    listDepartments()
      .then((list) => {
        if (!cancelled) setDepartments(list)
      })
      .catch(() => {
        // Non-fatal — the department switcher just won't render; filtering by department still
        // works if a code is set some other way, and the rest of the registry is unaffected.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Real, DB-computed counts for the selected department (Total Students, Certificates, Pending,
  // Minted, Revoked) — the "department dashboard" strip. Only fetched when a department is
  // actually selected; cleared otherwise.
  useEffect(() => {
    let cancelled = false
    // Always resolve asynchronously (even the "no department selected" case) so every setState
    // call happens inside a .then callback rather than synchronously in the effect body.
    Promise.resolve()
      .then(() => (selectedDepartment ? getDepartmentSummary(selectedDepartment) : null))
      .then((summary) => {
        if (cancelled) return
        setDeptSummary(summary)
        setDeptSummaryError('')
      })
      .catch((err) => {
        if (!cancelled) setDeptSummaryError(err.message || 'Could not load department summary')
      })
    return () => {
      cancelled = true
    }
  }, [selectedDepartment])

  const loadCertificates = (page = 0) => {
    setLoading(true)
    listCertificates({
      department: selectedDepartment,
      year: yearFilter,
      status: statusFilter,
      search: appliedSearch,
      page,
      size: PAGE_SIZE,
    })
      .then((res) => {
        setCertificates(res.content ?? [])
        setPageInfo({ page: res.page, totalPages: res.totalPages, totalElements: res.totalElements })
        setLoadError('')
      })
      .catch((err) => setLoadError(err.message || 'Could not load certificates'))
      .finally(() => setLoading(false))
  }

  // Re-fetches page 0 whenever a filter changes. Deliberately avoids any synchronous setState
  // call in the effect body (see AdminStudentsPage for the same pattern) — every update happens
  // inside a .then/.catch/.finally callback, so the table swaps in the new filtered data once it
  // arrives rather than flashing a skeleton state on every filter change.
  useEffect(() => {
    let cancelled = false
    listCertificates({
      department: selectedDepartment,
      year: yearFilter,
      status: statusFilter,
      search: appliedSearch,
      page: 0,
      size: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        setCertificates(res.content ?? [])
        setPageInfo({ page: res.page, totalPages: res.totalPages, totalElements: res.totalElements })
        setLoadError('')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load certificates')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDepartment, yearFilter, statusFilter, appliedSearch])

  // If the admin switches MetaMask accounts mid-session, clear any stale "wrong wallet" error
  // so the next click re-checks fresh instead of showing an outdated message.
  useEffect(() => {
    const unsubscribe = onAccountsChanged(() => setActionError(''))
    return unsubscribe
  }, [])

  const onSearchSubmit = (e) => {
    e.preventDefault()
    setAppliedSearch(searchInput.trim())
  }

  const selectDepartment = (code) => {
    setSelectedDepartment(code)
  }

  const applyUpdatedCertificate = (updated) => {
    setCertificates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setSelectedCertificate((prev) => (prev && prev.id === updated.id ? updated : prev))
    // The certificate's status just changed — the department dashboard counts (Pending/Minted/
    // Revoked) are now stale, so refresh them from the real DB values rather than guessing.
    if (selectedDepartment) {
      getDepartmentSummary(selectedDepartment).then(setDeptSummary).catch(() => {})
    }
  }

  const handleRevoke = async (cert) => {
    const reason = window.prompt(`Reason for revoking ${cert.certificateNumber}?`)
    if (!reason) return // required by the backend; cancel/blank aborts the action

    setActionError('')
    setBlockchainBusyId(cert.id)
    try {
      let updated
      if (cert.status === 'MINTED') {
        // Minted certificates must be revoked on-chain first, so the smart contract and the
        // database stay in sync (see CertificateService.updateStatus's guard on the backend).
        const { transactionHash } = await revokeCredentialOnChain({ tokenId: cert.tokenId, reason })
        updated = await revokeCertificateBlockchain(cert.id, { tokenId: cert.tokenId, transactionHash, reason })
      } else {
        // Never minted (still PENDING_MINT / MINT_FAILED) — same plain Phase 2 revoke as before.
        updated = await updateCertificateStatus(cert.id, 'REVOKED', reason)
      }
      applyUpdatedCertificate(updated)
    } catch (err) {
      setActionError(err.message || 'Failed to revoke certificate')
    } finally {
      setBlockchainBusyId(null)
    }
  }

  const handleIssueOnBlockchain = async (cert) => {
    setActionError('')

    if (!cert.studentWalletAddress) {
      setActionError('This student does not have a system-managed wallet on file yet.')
      return
    }
    if (!cert.fileHash) {
      setActionError('Upload the certificate PDF first — the blockchain credential needs its SHA-256 hash.')
      return
    }

    setBlockchainBusyId(cert.id)
    try {
      let transactionHash
      let tokenId
      let contractAddress
      try {
        // Step 1: admin's MetaMask signs and submits the mint transaction directly (or, if this
        // certificate turns out to already be minted on-chain, this recovers the existing record
        // instead of minting again).
        const result = await issueCredentialOnChain({
          certificateId: cert.id,
          certificateHash: cert.fileHash,
          studentWalletAddress: cert.studentWalletAddress,
        })
        transactionHash = result.transactionHash
        tokenId = result.tokenId
        contractAddress = result.contractAddress
      } catch (chainError) {
        console.info('[reconcile] caught error code from issueCredentialOnChain', {
          certificateId: cert.id,
          code: chainError.code,
        })
        // Confirmed already minted (tokenId is known), but the transaction hash couldn't be
        // found automatically — open the reconciliation modal so the admin can supply a hash
        // they already have (e.g. from the block explorer) instead of the certificate being stuck.
        if (chainError.code !== 'ALREADY_MINTED_NEEDS_TX_HASH') {
          throw chainError
        }
        setReconcileTarget({
          cert,
          tokenId: chainError.tokenId,
          contractAddress: chainError.contractAddress,
          message: chainError.message,
        })
        setReconcileHash('')
        setReconcileError('')
        return
      }

      // Step 2: backend independently re-verifies that transaction (status, contract, admin
      // wallet) against its own RPC before recording it.
      const updated = await issueCertificateBlockchain(cert.id, {
        studentWalletAddress: cert.studentWalletAddress,
        certificateHash: cert.fileHash,
        tokenId,
        contractAddress,
        transactionHash,
      })
      applyUpdatedCertificate(updated)
    } catch (err) {
      setActionError(err.message || 'Blockchain issuance failed')
    } finally {
      setBlockchainBusyId(null)
    }
  }

  const closeReconcileModal = () => {
    setReconcileTarget(null)
    setReconcileHash('')
    setReconcileError('')
  }

  // Submits a manually-supplied transaction hash for a certificate already confirmed minted
  // on-chain (via certificateIdToTokenId) whose hash couldn't be auto-recovered from event logs.
  // Reuses the exact same backend endpoint as a fresh mint — the backend independently verifies
  // the receipt (status/contract/admin wallet) before recording anything, whether the hash came
  // from a live mint or this manual path.
  const handleSubmitReconciliation = async () => {
    if (!reconcileTarget) return
    const trimmed = reconcileHash.trim()
    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      setReconcileError('Enter a valid transaction hash (0x followed by 64 hex characters).')
      return
    }

    const { cert, tokenId, contractAddress } = reconcileTarget
    console.info('[reconcile] submitting manual reconciliation', {
      certificateId: cert.id,
      tokenId,
      contractAddress,
      transactionHash: trimmed,
    })

    setReconcileSubmitting(true)
    setReconcileError('')
    try {
      const updated = await issueCertificateBlockchain(cert.id, {
        studentWalletAddress: cert.studentWalletAddress,
        certificateHash: cert.fileHash,
        tokenId,
        contractAddress,
        transactionHash: trimmed,
      })
      console.info('[reconcile] backend response', updated)
      applyUpdatedCertificate(updated)
      closeReconcileModal()
    } catch (err) {
      console.error('[reconcile] backend rejected reconciliation', {
        certificateId: cert.id,
        error: err.message,
      })
      setReconcileError(err.message || 'Reconciliation failed')
    } finally {
      setReconcileSubmitting(false)
    }
  }

  const handleDownload = async (cert) => {
    setActionError('')
    try {
      await downloadCertificateFile(cert.id, `${cert.certificateNumber}.pdf`)
    } catch (err) {
      setActionError(err.message || 'Failed to download certificate')
    }
  }

  const handleViewCertificate = (cert) => {
    setSelectedCertificate(cert)
  }

  const departmentLabel = (code) => departments.find((d) => d.code === code)?.label ?? code

  return (
    <section className="min-h-screen bg-surface-page py-14 sm:py-16">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <PageHeader
          eyebrow="Administration"
          title="Certificate registry"
          subtitle="Issued degree certificates, by department."
        />

        {loadError && (
          <Alert variant="error" title="Could not load certificates" className="mb-6">
            {loadError}
          </Alert>
        )}
        {actionError && (
          <Alert variant="error" title="Action failed" className="mb-6">
            {actionError}
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
              {dept.code}
            </button>
          ))}
        </div>

        {/* Department dashboard — real, DB-computed counts only */}
        {selectedDepartment && (
          <div className="mb-8">
            {deptSummaryError && (
              <Alert variant="error" title="Could not load department summary" className="mb-4">
                {deptSummaryError}
              </Alert>
            )}
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-h3 font-bold text-brand-primary">{departmentLabel(selectedDepartment)}</h2>
              <span className="text-caption text-brand-muted">({selectedDepartment})</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {!deptSummary ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonStatCard key={i} />)
              ) : (
                <>
                  <StatCard label="Total Students" value={deptSummary.totalStudents} />
                  <StatCard label="Certificates Issued" value={deptSummary.totalCertificates} />
                  <StatCard label="Pending" value={deptSummary.pendingMint} valueClassName="text-brand-accent" />
                  <StatCard label="Minted" value={deptSummary.minted} />
                  <StatCard label="Revoked" value={deptSummary.revoked} valueClassName="text-brand-danger" />
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Table Card */}
        <div>
          <Card>
            <CardHeader
              title="Certificate Records"
              subtitle={loading ? 'Loading…' : `${pageInfo.totalElements} certificate${pageInfo.totalElements === 1 ? '' : 's'}`}
              action={
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => navigate('/admin/issue-degree')}
                >
                  Issue New
                </Button>
              }
            />

            {/* Search and Filter */}
            <div className="border-b border-surface-line p-6">
              <form onSubmit={onSearchSubmit} className="flex flex-col gap-4 lg:flex-row">
                <div className="flex-1">
                  <Input
                    placeholder="Search by student name, USN, or certificate number..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="py-2.5"
                  />
                </div>
                <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="py-2.5 lg:w-40">
                  <option value="">All Years</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="py-2.5 lg:w-48">
                  <option value="">All Status</option>
                  <option value="PENDING_MINT">Pending Mint</option>
                  <option value="MINTED">Minted</option>
                  <option value="MINT_FAILED">Mint Failed</option>
                  <option value="REVOKED">Revoked</option>
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
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Student</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">USN</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Department</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Year</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Status</th>
                    <th className="px-6 py-5 text-left text-micro font-semibold uppercase tracking-wider text-brand-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-line">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} columns={6} />)
                  ) : certificates.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          title="No certificates found"
                          description="Try a different search term, department, year, or status filter."
                        />
                      </td>
                    </tr>
                  ) : (
                    certificates.map((cert) => (
                      <tr
                        key={cert.id}
                        className="transition-colors hover:bg-surface-sunken"
                      >
                        <td className="px-6 py-5">
                          <div>
                            <p className="font-semibold text-brand-ink">{cert.studentName}</p>
                            <p className="text-caption text-brand-muted/75">{cert.degreeName}</p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <code className="rounded bg-surface-sunken px-2 py-1 font-mono text-caption text-brand-muted">{cert.studentUsn}</code>
                        </td>
                        <td className="px-6 py-5">
                          <Badge variant="info">{cert.department}</Badge>
                        </td>
                        <td className="px-6 py-5 text-caption text-brand-muted">{cert.yearOfCompletion}</td>
                        <td className="px-6 py-5">
                          <Badge variant={statusMeta(cert.status).variant}>{statusMeta(cert.status).label}</Badge>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleViewCertificate(cert)}
                              className="rounded text-caption font-medium text-blue-600 transition-colors hover:text-blue-800"
                            >
                              View
                            </button>
                            {cert.fileAvailable && (
                              <button
                                onClick={() => handleDownload(cert)}
                                className="rounded text-caption font-medium text-brand-muted transition-colors hover:text-brand-ink"
                              >
                                Download
                              </button>
                            )}
                            {cert.status === 'PENDING_MINT' && cert.fileAvailable && (
                              <button
                                onClick={() => handleIssueOnBlockchain(cert)}
                                disabled={blockchainBusyId === cert.id}
                                className="rounded text-caption font-medium text-brand-accent transition-colors hover:text-orange-700 disabled:opacity-50"
                              >
                                {blockchainBusyId === cert.id ? 'Issuing…' : 'Issue on Blockchain'}
                              </button>
                            )}
                            {cert.status !== 'REVOKED' && (
                              <button
                                onClick={() => handleRevoke(cert)}
                                disabled={blockchainBusyId === cert.id}
                                className="rounded text-caption font-medium text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
                              >
                                {blockchainBusyId === cert.id ? 'Revoking…' : 'Revoke'}
                              </button>
                            )}
                          </div>
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
                onPageChange={loadCertificates}
              />
            )}
          </Card>
        </div>

        {/* Certificate Detail Modal */}
        <Modal open={Boolean(selectedCertificate)} onClose={() => setSelectedCertificate(null)} title="Certificate Details">
          {selectedCertificate && (
            <div className="space-y-6 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-caption text-brand-muted">Student Name</p>
                  <p className="font-semibold text-brand-ink">{selectedCertificate.studentName}</p>
                </div>
                <div>
                  <p className="text-caption text-brand-muted">USN</p>
                  <p className="font-mono text-caption text-brand-ink">{selectedCertificate.studentUsn}</p>
                </div>
                <div>
                  <p className="text-caption text-brand-muted">Certificate Number</p>
                  <p className="font-mono text-caption text-brand-ink">{selectedCertificate.certificateNumber}</p>
                </div>
                <div>
                  <p className="text-caption text-brand-muted">Degree</p>
                  <p className="font-semibold text-brand-ink">{selectedCertificate.degreeName}</p>
                </div>
                <div>
                  <p className="text-caption text-brand-muted">Department</p>
                  <p className="font-semibold text-brand-ink">{selectedCertificate.department}</p>
                </div>
                <div>
                  <p className="text-caption text-brand-muted">Year of Completion</p>
                  <p className="font-semibold text-brand-ink">{selectedCertificate.yearOfCompletion}</p>
                </div>
                <div>
                  <p className="mb-1 text-caption text-brand-muted">Status</p>
                  <Badge variant={statusMeta(selectedCertificate.status).variant}>
                    {statusMeta(selectedCertificate.status).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-caption text-brand-muted">Issued Date</p>
                  <p className="font-semibold text-brand-ink">{selectedCertificate.issuedAt?.slice(0, 10)}</p>
                </div>
                {selectedCertificate.revokedReason && (
                  <div className="md:col-span-2">
                    <p className="text-caption text-brand-muted">Revoked Reason</p>
                    <p className="font-semibold text-brand-ink">{selectedCertificate.revokedReason}</p>
                  </div>
                )}
                <div className="md:col-span-2">
                  <p className="mb-1 text-caption text-brand-muted">SHA-256 File Hash</p>
                  {selectedCertificate.fileHash ? (
                    <div className="flex items-start justify-between gap-2 rounded bg-surface-sunken p-2">
                      <p className="break-all font-mono text-micro text-brand-ink">{selectedCertificate.fileHash}</p>
                      <CopyButton value={selectedCertificate.fileHash} label="SHA-256 hash" />
                    </div>
                  ) : (
                    <p className="text-caption text-brand-muted/75 italic">No file uploaded yet</p>
                  )}
                </div>
                {selectedCertificate.fileAvailable && (
                  <div className="md:col-span-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(selectedCertificate)}>
                      Download PDF
                    </Button>
                  </div>
                )}

                {/* Blockchain section (Phase 3) */}
                <div className="border-t border-surface-line pt-4 md:col-span-2">
                  <p className="mb-2 text-caption font-semibold text-brand-muted">Blockchain</p>

                  {selectedCertificate.status === 'MINTED' || selectedCertificate.status === 'REVOKED' ? (
                    <div className="space-y-3 rounded-lg bg-surface-sunken p-4 text-caption">
                      <div className="flex items-center justify-between">
                        <span className="text-brand-muted">Blockchain Status:</span>
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${
                            selectedCertificate.status === 'REVOKED' ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {selectedCertificate.status !== 'REVOKED' && (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                          {selectedCertificate.status === 'REVOKED' ? 'REVOKED' : 'ISSUED'}
                        </span>
                      </div>
                      <div>
                        <span className="mb-1 block text-brand-muted">Transaction Hash:</span>
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={`${BLOCK_EXPLORER_URL}/tx/${selectedCertificate.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-mono text-micro text-blue-600 hover:underline"
                          >
                            {selectedCertificate.txHash}
                          </a>
                          <CopyButton value={selectedCertificate.txHash} label="transaction hash" />
                        </div>
                      </div>
                      <div>
                        <span className="mb-1 block text-brand-muted">Token / Credential ID:</span>
                        <span className="font-mono text-micro text-brand-ink">{selectedCertificate.tokenId}</span>
                      </div>
                      <div>
                        <span className="mb-1 block text-brand-muted">Student Wallet:</span>
                        <div className="flex items-start justify-between gap-2">
                          <span className="break-all font-mono text-micro text-brand-ink">{selectedCertificate.walletAddress}</span>
                          <CopyButton value={selectedCertificate.walletAddress} label="student wallet address" />
                        </div>
                      </div>
                      <div>
                        <span className="mb-1 block text-brand-muted">Contract:</span>
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={`${BLOCK_EXPLORER_URL}/address/${selectedCertificate.contractAddress}`}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-mono text-micro text-blue-600 hover:underline"
                          >
                            {selectedCertificate.contractAddress}
                          </a>
                          <CopyButton value={selectedCertificate.contractAddress} label="contract address" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-surface-sunken p-4 text-caption">
                      <p className="mb-3 text-brand-muted">
                        Not yet issued on-chain. Student's system-managed wallet:{' '}
                        <span className="font-mono text-micro text-brand-ink">
                          {selectedCertificate.studentWalletAddress || 'none on file'}
                        </span>
                      </p>
                      {selectedCertificate.fileAvailable ? (
                        <Button
                          variant="accent"
                          size="sm"
                          loading={blockchainBusyId === selectedCertificate.id}
                          onClick={() => handleIssueOnBlockchain(selectedCertificate)}
                        >
                          Issue on Blockchain
                        </Button>
                      ) : (
                        <p className="text-micro italic text-brand-muted/75">Upload the certificate PDF before issuing on the blockchain.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Blockchain Reconciliation Modal — shown when a certificate is confirmed already
            minted on-chain but its transaction hash couldn't be recovered automatically. */}
        <Modal open={Boolean(reconcileTarget)} onClose={closeReconcileModal} title="Complete blockchain reconciliation" size="md">
          {reconcileTarget && (
            <div className="space-y-6 p-6">
              <p className="text-caption text-brand-muted">{reconcileTarget.message}</p>
              <div className="grid grid-cols-2 gap-4 text-caption">
                <div>
                  <p className="text-brand-muted">Token ID</p>
                  <p className="font-mono font-semibold text-brand-ink">{reconcileTarget.tokenId}</p>
                </div>
                <div>
                  <p className="text-brand-muted">Contract</p>
                  <p className="break-all font-mono text-micro text-brand-ink">{reconcileTarget.contractAddress}</p>
                </div>
              </div>
              <Input
                label="Transaction hash"
                required
                placeholder="0x..."
                value={reconcileHash}
                onChange={(e) => setReconcileHash(e.target.value)}
                error={reconcileError}
                hint="Find this on the block explorer for the mint transaction."
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={closeReconcileModal} disabled={reconcileSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitReconciliation} loading={reconcileSubmitting}>
                  Submit
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </section>
  )
}

