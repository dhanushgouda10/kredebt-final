import { getAuthToken, parseErrorMessage } from '../utils/http'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

function authHeaders(extra = {}) {
  const token = getAuthToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// GET /api/admin/departments — the fixed department catalog, each with
// its current real student count. Used to populate every department picker/filter in the admin
// portal, so the list only ever comes from one place.
export async function listDepartments() {
  const res = await fetch(`${API_BASE}/api/admin/departments`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/admin/departments/{code}/summary — real, DB-computed counts (students, certificates,
// pending/minted/mint-failed/revoked) for one department. Backs the department dashboard strip
// at the top of the Certificate Registry.
export async function getDepartmentSummary(code) {
  const res = await fetch(`${API_BASE}/api/admin/departments/${encodeURIComponent(code)}/summary`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}
