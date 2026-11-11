import { describe, it, expect } from 'vitest'
import { isValidEmail, validateEmail, normalizeEmail, EMAIL_ERROR } from './email'

describe('isValidEmail', () => {
  it.each([
    'student@greenfield.edu',
    'first.last@college.ac.in',
    'usn_1234@university.edu.in',
    'a+tag@example.com',
    'name-with-dash@sub.domain.org',
  ])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isValidEmail('  Student@Greenfield.EDU  ')).toBe(true)
  })

  it.each([
    '',
    'plainaddress',
    '@no-local.edu',
    'no-domain@',
    'two@@signs.edu',
    'spaces in@local.edu',
    'trailing-dot@domain.',
    'no-tld@domain',
  ])('rejects %s', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })
})

describe('validateEmail', () => {
  it('reports a missing address separately from a malformed one', () => {
    expect(validateEmail('')).toBe('Email address is required.')
    expect(validateEmail('   ')).toBe('Email address is required.')
    expect(validateEmail('nope')).toBe(EMAIL_ERROR)
  })

  it('returns an empty string when valid', () => {
    expect(validateEmail('student@college.edu')).toBe('')
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Student@College.EDU ')).toBe('student@college.edu')
  })

  it('returns an empty string for non-strings', () => {
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(null)).toBe('')
  })
})
