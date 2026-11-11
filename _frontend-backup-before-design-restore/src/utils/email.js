/**
 * Email validation for student accounts.
 *
 * Kredent serves many institutions, so no single college domain is required — only a well-formed
 * address. This is for immediate feedback in the form; the backend (@Email on RegisterRequest) is
 * the actual security boundary.
 */

export const EMAIL_ERROR = 'Please enter a valid email address.'

// Deliberately conservative: one "@", no whitespace, a dot in the domain, no leading/trailing dot.
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/

/** Trim and lowercase — the form should submit the normalised value. */
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value))
}

/** Returns an error message, or '' when valid. */
export function validateEmail(value) {
  const email = normalizeEmail(value)
  if (!email) return 'Email address is required.'
  return isValidEmail(email) ? '' : EMAIL_ERROR
}
