/**
 * Single source of truth for certificate status presentation.
 *
 * This map was previously duplicated verbatim in four places
 * (IssuedCertificatesPage, StudentDashboardPage, MyCertificatesPage and
 * StudentCertificateDetailPage), which meant a status label could drift
 * between the admin and student views of the same record. Centralised here
 * so every surface names a status identically.
 *
 * `label` is the short form used inside badges. `plain` is a full sentence
 * written for students and employers rather than developers — the admin
 * surfaces keep using `label`, the student-facing surfaces use `plain`.
 */
const STATUS_META = {
  PENDING_MINT: {
    label: 'Pending Mint',
    variant: 'warning',
    plain: 'Issued by the college. Blockchain registration is still in progress.',
  },
  MINTED: {
    label: 'Minted',
    variant: 'success',
    plain: 'Verified and permanently recorded on the blockchain.',
  },
  MINT_FAILED: {
    label: 'Mint Failed',
    variant: 'danger',
    plain: 'Blockchain registration did not complete. Please contact the college office.',
  },
  REVOKED: {
    label: 'Revoked',
    variant: 'danger',
    plain: 'This certificate has been revoked by the issuing institution and is no longer valid.',
  },
}

export function certificateStatusMeta(status) {
  return STATUS_META[status] ?? { label: status, variant: 'neutral', plain: '' }
}
