/**
 * Institutional email rule for student accounts.
 *
 * Students must use their official MVJCE address. This is enforced here for
 * immediate feedback in the form, and independently on the backend (a Bean
 * Validation constraint on RegisterRequest) which is the actual security
 * boundary — client-side checks are trivially bypassed and are never the rule.
 *
 * Kept deliberately strict:
 *   - exactly @mvjce.edu.in, so mvjce.ac.in / mvjce.edu / sub.mvjce.edu.in fail
 *   - no leading/trailing whitespace once trimmed
 *   - case-insensitive, because MVJCE.EDU.IN is the same mailbox
 */
export const COLLEGE_EMAIL_DOMAIN = 'mvjce.edu.in'

export const COLLEGE_EMAIL_ERROR =
  'Please use your official MVJCE email address ending with @mvjce.edu.in.'

// Anchored on both ends so nothing can be appended after the domain.
const COLLEGE_EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@mvjce\.edu\.in$/i

/** Trim and lowercase — the form should submit the normalised value. */
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isCollegeEmail(value) {
  return COLLEGE_EMAIL_PATTERN.test(normalizeEmail(value))
}

/**
 * Returns an error message, or '' when valid. Distinguishes "missing" from
 * "wrong domain" so the form can say something useful in each case.
 */
export function validateCollegeEmail(value) {
  const email = normalizeEmail(value)
  if (!email) return 'Email address is required.'
  return isCollegeEmail(email) ? '' : COLLEGE_EMAIL_ERROR
}
