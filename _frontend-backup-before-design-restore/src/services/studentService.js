import { getAuthToken, parseErrorMessage } from '../utils/http'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

function authHeaders(extra = {}) {
  const token = getAuthToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// GET /api/student/me — the logged-in student's own profile (name, USN, department, wallet...).
export async function getOwnProfile() {
  const res = await fetch(`${API_BASE}/api/student/me`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// PUT /api/student/me — self-service update. Matches the backend's UpdateStudentProfileRequest
// exactly (fullName + phone only — email/USN are identity fields and aren't editable here).
export async function updateOwnProfile({ fullName, phone }) {
  const res = await fetch(`${API_BASE}/api/student/me`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fullName, phone }),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}
