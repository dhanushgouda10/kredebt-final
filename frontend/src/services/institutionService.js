import { getAuthToken, toApiError } from '../utils/http'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await toApiError(res)
  return res.json()
}

/**
 * Step 1-2 — look an institutional ID (Demo AICTE PID) up in the registry. Resolves with the
 * registered name/state/district/HOI email, or rejects with an ApiError whose `code` is
 * INSTITUTION_NOT_FOUND, INSTITUTION_PENDING or INSTITUTION_SUSPENDED.
 */
export function lookupInstitution(institutionId) {
  return postJson('/api/auth/institution/lookup', { institutionId: institutionId.trim() })
}

/**
 * Step 3 — ask the backend to email a six-digit OTP to the registry's HOI address. The response
 * never contains the OTP; it returns a session handle and timings for the countdown.
 */
export function sendInstitutionOtp(institutionId) {
  return postJson('/api/auth/institution/otp/send', { institutionId: institutionId.trim() })
}

/** Step 4 — submit the emailed code for the session returned by sendInstitutionOtp. */
export function verifyInstitutionOtp(sessionId, otp) {
  return postJson('/api/auth/institution/otp/verify', { sessionId, otp })
}

/** Step 5 — link the signed-in MetaMask wallet and register the institution. Resolves with an auth response. */
export function completeInstitutionRegistration({ sessionId, walletAddress, signature }) {
  return postJson('/api/auth/institution/complete', { sessionId, walletAddress, signature })
}

/** The signed-in administrator's own institution (re-validated against the registry server-side). */
export async function getCurrentInstitution() {
  const token = getAuthToken()
  const res = await fetch(`${API_BASE}/api/admin/institution`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw await toApiError(res)
  return res.json()
}
