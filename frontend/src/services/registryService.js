import { toApiError } from '../utils/http'

/**
 * Client for the Kredent institutional registry (registration, email verification, approval).
 * The registry administrator's token lives in sessionStorage, separate from Kredent's own
 * `kredent_auth` session, so the two can never be confused.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081'
const TOKEN_KEY = 'kredent_registry_admin'

export function getRegistryAdminSession() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function registryAdminLogout() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage unavailable — nothing to clear
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const session = getRegistryAdminSession()
    if (session?.token) headers.Authorization = `Bearer ${session.token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await toApiError(res)
    // An expired/invalid registry-admin token should send the admin back to sign in.
    if (auth && (res.status === 401 || res.status === 403)) registryAdminLogout()
    throw err
  }
  return res.json()
}

export const registerCollege = (body) => request('/api/registry/institutions', { method: 'POST', body })

export const sendRegistryEmailOtp = (email) =>
  request('/api/registry/email/send', { method: 'POST', body: { email: email.trim() } })

/** Verifies the code and resolves with { verified, institutionId, message } — the ID is only revealed here. */
export const verifyRegistryEmail = (email, otp) =>
  request('/api/registry/email/verify', { method: 'POST', body: { email: email.trim(), otp } })

export async function registryAdminLogin(email, password) {
  const session = await request('/api/registry/admin/login', { method: 'POST', body: { email, password } })
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session))
  } catch {
    // storage unavailable — the session just won't survive a reload
  }
  return session
}

export const listRegistryInstitutions = () => request('/api/registry/admin/institutions', { auth: true })
export const listRegistryLogs = () => request('/api/registry/admin/logs', { auth: true })

export const approveRegistryInstitution = (institutionId) =>
  request(`/api/registry/admin/institutions/${encodeURIComponent(institutionId)}/approve`, { method: 'POST', auth: true })

export const suspendRegistryInstitution = (institutionId) =>
  request(`/api/registry/admin/institutions/${encodeURIComponent(institutionId)}/suspend`, { method: 'POST', auth: true })

/** Public list of institutions the registry has approved (no contact details). */
export const listApprovedInstitutions = (search = '') =>
  request(`/api/auth/institution/list${search ? `?search=${encodeURIComponent(search)}` : ''}`)
