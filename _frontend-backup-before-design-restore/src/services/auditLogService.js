import { getAuthToken, parseErrorMessage } from '../utils/http'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

function authHeaders(extra = {}) {
  const token = getAuthToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// GET /api/admin/audit-logs?search=&action=&department=&page=&size= — admin-only (enforced
// server-side by SecurityConfig's /api/admin/** rule), read-only. Each row already comes back
// enriched (certificate number, student name/USN, department, admin actor name, transaction
// hash) by the backend — see AuditLogService.listAll / listFiltered / toResponse. search/action/
// department are each optional; when any is set, filtering happens server-side
// (AuditLogService.listFiltered) so this never needs to fetch more than one page of rows
// regardless of how many audit entries exist.
export async function listAuditLogs({ search = '', action = '', department = '', page = 0, size = 25 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (search) params.set('search', search)
  if (action) params.set('action', action)
  if (department) params.set('department', department)
  const res = await fetch(`${API_BASE}/api/admin/audit-logs?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}
