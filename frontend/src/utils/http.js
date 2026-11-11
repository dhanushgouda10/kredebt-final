const AUTH_STORAGE_KEY = 'kredent_auth'

/** Reads the JWT saved by AuthContext on login, or null if not logged in. */
export function getAuthToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw)?.token ?? null : null
  } catch {
    return null
  }
}

/**
 * Reads a human-readable error message out of a failed fetch Response.
 * Understands the shape returned by the Spring Boot backend (message /
 * detail / title / field validation `errors[]`) and falls back to the
 * HTTP status text if the body isn't JSON.
 */
export async function parseErrorMessage(response) {
  try {
    const data = await response.json()
    return (
      data.message ||
      data.detail ||
      data.title ||
      (Array.isArray(data.errors) ? data.errors.map((e) => e.defaultMessage || e.message).join(', ') : null) ||
      response.statusText
    )
  } catch {
    return response.statusText || 'Request failed'
  }
}

/**
 * Error carrying the backend's stable `code` (e.g. INSTITUTION_NOT_FOUND, OTP_INVALID), the HTTP
 * status and, for cooldowns, `retryAfterSeconds` — so screens can branch on the code instead of
 * parsing English messages.
 */
export class ApiError extends Error {
  constructor(message, { status, code, retryAfterSeconds } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Builds an ApiError from a failed fetch Response (never throws while reading the body). */
export async function toApiError(response) {
  let data = null
  try {
    data = await response.json()
  } catch {
    // body wasn't JSON — fall through to the status text
  }
  const message =
    data?.message ||
    data?.detail ||
    data?.title ||
    response.statusText ||
    'Request failed'
  return new ApiError(message, {
    status: response.status,
    code: data?.code,
    retryAfterSeconds: data?.retryAfterSeconds,
  })
}
