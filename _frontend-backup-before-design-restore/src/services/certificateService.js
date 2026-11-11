import { getAuthToken, parseErrorMessage } from '../utils/http'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

function authHeaders(extra = {}) {
  const token = getAuthToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// GET /api/admin/students?search=... — used to populate the student picker on Issue Degree.
export async function searchStudents(search = '') {
  const params = new URLSearchParams({ size: '50' })
  if (search) params.set('search', search)
  const res = await fetch(`${API_BASE}/api/admin/students?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// POST /api/admin/certificates — creates the certificate metadata row (no file yet).
export async function createCertificate(payload) {
  const res = await fetch(`${API_BASE}/api/admin/certificates`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// POST /api/admin/certificates/{id}/upload — attaches the PDF, which is where the
// backend computes the real SHA-256 hash and stores the file in Supabase Storage.
export async function uploadCertificateFile(certificateId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/api/admin/certificates/${certificateId}/upload`, {
    method: 'POST',
    headers: authHeaders(), // no Content-Type — the browser sets the multipart boundary
    body: formData,
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/admin/certificates?search=&department=&year=&status=&page=&size= — the Certificate
// Registry. department/year/status are each optional; when any is set, filtering happens
// server-side (CertificateService.listFiltered on the backend) so this never needs to fetch more
// than one page of rows regardless of how many certificates exist.
export async function listCertificates({ search = '', department = '', year = '', status = '', page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (search) params.set('search', search)
  if (department) params.set('department', department)
  if (year) params.set('year', String(year))
  if (status) params.set('status', status)
  const res = await fetch(`${API_BASE}/api/admin/certificates?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/student/certificates?page=&size= — only the logged-in student's own certificates.
// Ownership is enforced entirely server-side (the STUDENT-scoped JWT identifies the student —
// nothing here sends a student ID for the backend to trust).
export async function getMyCertificates({ page = 0, size = 100 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  const res = await fetch(`${API_BASE}/api/student/certificates?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/certificates/{id} — reachable by any authenticated user, but the backend only returns
// the certificate if it belongs to the requesting student (or the caller is an admin) — see
// CertificateService.assertCanView. A student can never fetch another student's certificate by
// changing this ID.
export async function getCertificateById(certificateId) {
  const res = await fetch(`${API_BASE}/api/certificates/${certificateId}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// PATCH /api/admin/certificates/{id}/status — used for revoking (reason required by the backend).
export async function updateCertificateStatus(certificateId, status, reason) {
  const res = await fetch(`${API_BASE}/api/admin/certificates/${certificateId}/status`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status, reason }),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/certificates/{id}/download — streams the PDF; triggers a browser download.
export async function downloadCertificateFile(certificateId, suggestedFilename) {
  const res = await fetch(`${API_BASE}/api/certificates/${certificateId}/download`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = suggestedFilename || 'certificate.pdf'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// POST /api/admin/certificates/{id}/blockchain/issue — called AFTER MetaMask has already
// signed and mined the on-chain issueCredential() transaction (see blockchainService.js). The
// backend independently re-verifies the transaction before saving any of this.
export async function issueCertificateBlockchain(certificateId, payload) {
  const res = await fetch(`${API_BASE}/api/admin/certificates/${certificateId}/blockchain/issue`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// POST /api/admin/certificates/{id}/blockchain/revoke — same idea, for a revokeCredential() transaction.
export async function revokeCertificateBlockchain(certificateId, payload) {
  const res = await fetch(`${API_BASE}/api/admin/certificates/${certificateId}/blockchain/revoke`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}
