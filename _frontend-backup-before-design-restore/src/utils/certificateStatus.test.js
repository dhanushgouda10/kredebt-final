import { describe, it, expect } from 'vitest'
import { certificateStatusMeta } from './certificateStatus'

// The backend Certificate.status enum. If a value is ever added there, the
// corresponding case must be added here too — this list is the contract.
const BACKEND_STATUSES = ['PENDING_MINT', 'MINTED', 'MINT_FAILED', 'REVOKED']

describe('certificateStatusMeta', () => {
  it.each(BACKEND_STATUSES)('maps %s to a complete presentation object', (status) => {
    const meta = certificateStatusMeta(status)
    expect(meta.label).toBeTruthy()
    expect(meta.variant).toBeTruthy()
    expect(meta.plain).toBeTruthy()
  })

  it('uses only variants the Badge component understands', () => {
    const allowed = ['success', 'danger', 'warning', 'info', 'neutral']
    for (const status of BACKEND_STATUSES) {
      expect(allowed).toContain(certificateStatusMeta(status).variant)
    }
  })

  it('marks MINTED as success and REVOKED as danger', () => {
    expect(certificateStatusMeta('MINTED').variant).toBe('success')
    expect(certificateStatusMeta('REVOKED').variant).toBe('danger')
  })

  it('treats a failed mint as a danger state, not a warning', () => {
    expect(certificateStatusMeta('MINT_FAILED').variant).toBe('danger')
  })

  it('degrades safely for an unrecognised status instead of throwing', () => {
    const meta = certificateStatusMeta('SOME_FUTURE_STATUS')
    expect(meta.label).toBe('SOME_FUTURE_STATUS')
    expect(meta.variant).toBe('neutral')
  })

  it('does not throw on null or undefined', () => {
    expect(() => certificateStatusMeta(undefined)).not.toThrow()
    expect(() => certificateStatusMeta(null)).not.toThrow()
  })

  it('writes plain-language text without raw enum names leaking through', () => {
    for (const status of BACKEND_STATUSES) {
      expect(certificateStatusMeta(status).plain).not.toMatch(/_/)
    }
  })
})
