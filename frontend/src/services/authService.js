import { parseErrorMessage } from '../utils/http'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'

export async function registerStudent(body) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/auth/departments — public, unauthenticated. Populates the department dropdown on the
// self-registration form with the same canonical catalog (code + label, no student counts) the
// backend validates registrations against — see AuthService.register.
export async function listPublicDepartments() {
  const res = await fetch(`${API_BASE}/api/auth/departments`)
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

export async function loginStudent(body) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

/**
 * Step 1 of admin login: ask the backend for a one-time challenge to sign.
 *
 * The nonce is short-lived and single-use. Requesting one does NOT authenticate
 * anything and does not reveal whether the address belongs to an admin — the
 * backend issues a challenge either way, so this endpoint cannot be used to
 * enumerate admin wallets.
 */
export async function requestAdminNonce(walletAddress) {
  const res = await fetch(
    `${API_BASE}/api/auth/admin/nonce?address=${encodeURIComponent(walletAddress)}`,
  )
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  const data = await res.json()
  if (!data?.nonce) {
    throw new Error('The server did not return a valid login challenge.')
  }
  return data.nonce
}

/**
 * Step 3 of admin login: submit the signed challenge.
 *
 * Proof of wallet ownership. The backend recovers the signer from the nonce +
 * signature and only issues an ADMIN token if the recovered address matches the
 * claimed one AND that address is a registered admin. Knowing a public address
 * is therefore no longer sufficient to log in.
 *
 * The signature is sent once and never persisted client-side. `institutionId` is the institutional
 * ID (Demo AICTE PID) the administrator is signing in for.
 */
export async function loginAdminWithSignature(walletAddress, signature, institutionId) {
  const res = await fetch(`${API_BASE}/api/auth/admin/wallet-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // institutionId says WHICH institution's dashboard to open — several institutions may share
    // one wallet, so the wallet alone is ambiguous. The backend re-validates the institution's
    // registry status on every sign-in.
    body: JSON.stringify({ walletAddress, signature, institutionId }),
  })
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}

// GET /api/auth/institution/list — public. The colleges approved in the institutional registry, flagged
// with `joinedKredent` (true once the college administrator has completed verification). Students can
// only register at, and sign in to, a college that has joined.
export async function listColleges(search = '') {
  const res = await fetch(`${API_BASE}/api/auth/institution/list${search ? `?search=${encodeURIComponent(search)}` : ''}`)
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json()
}
