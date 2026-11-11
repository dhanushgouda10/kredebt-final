import { useEffect, useState } from 'react'
import { Alert, Button, Input } from '../ui'
import { OtpInput } from '../institution/OtpInput'
import { sendRegistryEmailOtp, verifyRegistryEmail } from '../../services/registryService'

/** Sends and verifies the registry email OTP. The code is never shown or logged by the client. */
export function EmailVerifyForm({ initialId = '', alreadySent = false, onVerified }) {
  const [institutionId, setInstitutionId] = useState(initialId)
  // If registration already emailed a code, start in the "enter code" state.
  const [sent, setSent] = useState(() =>
    alreadySent
      ? { maskedEmail: 'the official email you registered', expiresAt: Date.now() + 300000, resendAt: Date.now() + 60000 }
      : null,
  )
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!sent) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sent])

  const send = async (e) => {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await sendRegistryEmailOtp(institutionId)
      const t = Date.now()
      setSent({
        maskedEmail: r.maskedEmail,
        expiresAt: t + r.expiresInSeconds * 1000,
        resendAt: t + r.resendAvailableInSeconds * 1000,
      })
      setNow(t)
      setOtp('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await verifyRegistryEmail(institutionId, otp)
      setDone(true)
      onVerified?.(institutionId)
    } catch (err) {
      setOtp('')
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Alert variant="success" title="Email verified">
        The official email for <strong>{institutionId}</strong> is verified. The registry administrator can now approve
        the institution.
      </Alert>
    )
  }

  const left = sent ? Math.max(0, Math.ceil((sent.expiresAt - now) / 1000)) : 0
  const wait = sent ? Math.max(0, Math.ceil((sent.resendAt - now) / 1000)) : 0

  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-5">
        <Input label="Institutional ID" name="institutionId" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} required />
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>Send verification code</Button>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-5">
      <p className="text-caption text-brand-muted">
        Enter the 6-digit code sent to <strong className="text-brand-ink">{sent.maskedEmail}</strong>.
      </p>
      <OtpInput value={otp} onChange={(v) => { setOtp(v); setError('') }} disabled={busy} hasError={Boolean(error)} autoFocus />
      <p className="text-center text-caption text-brand-muted" aria-live="polite">
        {left > 0 ? `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Code expired — request a new one.'}
      </p>
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} disabled={otp.length !== 6 || left === 0}>
        Verify email
      </Button>
      <button type="button" onClick={send} disabled={busy || wait > 0}
        className="block w-full text-center text-caption font-semibold text-brand-accent underline underline-offset-2 disabled:text-brand-muted disabled:no-underline">
        {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
      </button>
    </form>
  )
}
