import { describe, it, expect } from 'vitest'
import {
  isCollegeEmail,
  validateCollegeEmail,
  normalizeEmail,
  COLLEGE_EMAIL_ERROR,
} from './collegeEmail'

describe('isCollegeEmail — accepted', () => {
  it.each([
    'student@mvjce.edu.in',
    'first.last@mvjce.edu.in',
    'usn_1234@mvjce.edu.in',
    'a+tag@mvjce.edu.in',
    'name-with-dash@mvjce.edu.in',
    '1ms21cs001@mvjce.edu.in',
  ])('accepts %s', (email) => {
    expect(isCollegeEmail(email)).toBe(true)
  })

  it.each([
    'STUDENT@MVJCE.EDU.IN',
    'Student@Mvjce.Edu.In',
    'student@MVJCE.edu.in',
  ])('is case-insensitive: %s', (email) => {
    expect(isCollegeEmail(email)).toBe(true)
  })

  it('tolerates surrounding whitespace from copy-paste', () => {
    expect(isCollegeEmail('  student@mvjce.edu.in  ')).toBe(true)
  })
})

describe('isCollegeEmail — rejected', () => {
  it.each([
    ['abc@gmail.com', 'gmail'],
    ['student@yahoo.com', 'yahoo'],
    ['student@outlook.com', 'outlook'],
    ['student@mvjce.ac.in', 'wrong TLD — .ac.in not .edu.in'],
    ['student@mvjce.edu', 'truncated domain'],
    ['student@mvjce.edu.in.evil.com', 'domain used as a prefix of an attacker domain'],
    ['student@sub.mvjce.edu.in', 'subdomain is not the official domain'],
    ['student@notmvjce.edu.in', 'domain used as a suffix'],
    ['student@mvjce.edu.in.', 'trailing dot after domain'],
    ['student@mvjce.edu.in/x', 'trailing path after domain'],
  ])('rejects %s (%s)', (email) => {
    expect(isCollegeEmail(email)).toBe(false)
  })

  it.each(['', '   ', 'student', 'student@', '@mvjce.edu.in', 'student mvjce.edu.in'])(
    'rejects malformed input: %s',
    (email) => {
      expect(isCollegeEmail(email)).toBe(false)
    },
  )

  it('does not throw on null or undefined', () => {
    expect(isCollegeEmail(undefined)).toBe(false)
    expect(isCollegeEmail(null)).toBe(false)
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  STUDENT@MVJCE.EDU.IN ')).toBe('student@mvjce.edu.in')
  })

  it('returns an empty string for non-string input', () => {
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(42)).toBe('')
  })
})

describe('validateCollegeEmail', () => {
  it('returns no error for a valid college address', () => {
    expect(validateCollegeEmail('student@mvjce.edu.in')).toBe('')
  })

  it('distinguishes a missing email from a wrong domain', () => {
    expect(validateCollegeEmail('')).toMatch(/required/i)
    expect(validateCollegeEmail('abc@gmail.com')).toBe(COLLEGE_EMAIL_ERROR)
  })

  it('names the required domain in the error so the user knows what to do', () => {
    expect(validateCollegeEmail('abc@gmail.com')).toContain('@mvjce.edu.in')
  })
})
