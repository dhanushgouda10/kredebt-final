import { getAuthToken, parseErrorMessage } from '../utils/http'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

function authHeaders(extra = {}) {
  const token = getAuthToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// GET /api/admin/students?search=&department=&page=&size= — the admin student registry.
// department is optional; when set, both the department filter and the search stay server-side
// and paginated (StudentService.listStudentsByDepartment on the backend) — this never fetches a
// department's whole roster to filter it in the browser.
export async function listStudents({ search = '', department = '', page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (search) params.set('search', search)
  if (department) params.set('department', department)
  const res = await fetch(`${API_BASE}/api/admin/students?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/admin/students/{id} — a single student's full record, for the student detail view.
export async function getStudentById(id) {
  const res = await fetch(`${API_BASE}/api/admin/students/${id}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/admin/students/{studentId}/certificates — the certificates already issued to one
// student, shown inline on the student detail view (department -> student -> certificate).
export async function getStudentCertificates(studentId, { page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  const res = await fetch(`${API_BASE}/api/admin/students/${studentId}/certificates?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// POST /api/admin/students — creates a student account. The backend generates and assigns a
// system-managed blockchain wallet automatically (see WalletService.generateWallet) — this never
// handles a private key or wallet address itself.
export async function createStudent(payload) {
  const res = await fetch(`${API_BASE}/api/admin/students`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// PUT /api/admin/students/{id} — updates name/email/phone/department. USN is not editable
// (it's the natural key certificates are issued against) — enforced server-side.
export async function updateStudent(id, payload) {
  const res = await fetch(`${API_BASE}/api/admin/students/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}
