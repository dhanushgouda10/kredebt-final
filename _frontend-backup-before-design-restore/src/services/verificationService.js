import { parseErrorMessage } from '../utils/http'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

// GET /api/verify/{certificateNumber} — public, unauthenticated (no login, no JWT sent). Always
// returns 200 with a `result` field (VERIFIED/REVOKED/INVALID/UNAVAILABLE); "not found" is a
// verification outcome, not an HTTP error, so this only throws on genuine network/server failure.
export async function verifyCertificate(certificateNumber) {
  const res = await fetch(`${API_BASE}/api/verify/${encodeURIComponent(certificateNumber)}`)
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// POST /api/verify/{certificateNumber}/pdf — public, unauthenticated. Unlike verifyCertificate()
// above, this does NOT always return 200: "certificate not found", "no official PDF on file yet",
// and "not a PDF" are genuine request errors here (there's nothing to compare against), so those
// throw. A real comparison (AUTHENTIC/TAMPERED) or REVOKED always comes back as 200.
export async function verifyCertificatePdf(certificateNumber, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/api/verify/${encodeURIComponent(certificateNumber)}/pdf`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}
