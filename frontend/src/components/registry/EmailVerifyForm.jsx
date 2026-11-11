import { useEffect, useState } from 'react'
import { Alert, Button, Input } from '../ui'
import { Link } from 'react-router-dom'
import { CopyButton } from '../ui/CopyButton'
import { OtpInput } from '../institution/OtpInput'
import { sendRegistryEmailOtp, verifyRegistryEmail } from '../../services/registryService'

/** Sends and verifies the registry email OTP. The code is never shown or logged by the client. */
export function EmailVerifyForm({ initialEmail = '', alreadySent = false, onVerified }) {
  const [email, setEmail] = useState(initialEmail)
  const [institutionId, setInstitutionId] = useState('')
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
      const r = await sendRegistryEmailOtp(email)
      const t = Date.now()
      setSent({
        maskedEmail: r.maskedEmail,
        expiresAt: t + r.expiresInSeconds * 1000,
        resendAt: t + r.resendAvailableInSeconds * 1000,
      })
      setNow(t)
      setOtp('')
    } catch (err) {
      if (err.code === 'RESEND_COOLDOWN' && !sent) {
        // A code was sent a moment ago: go to the code box instead of showing an error.
        const t = Date.now()
        setSent({
          maskedEmail: 'the official email you registered',
          expiresAt: t + 300000,
          resendAt: t + (err.retryAfterSeconds ?? 60) * 1000,
        })
        setNow(t)
        setOtp('')
      } else {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await verifyRegistryEmail(email, otp)
      setInstitutionId(r.institutionId)
      setDone(true)
      onVerified?.(r.institutionId)
    } catch (err) {
      setOtp('')
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Email verified">Your institution is registered.</Alert>
        <div className="rounded-lg border-2 border-brand-accent bg-surface-sunken p-5 text-center">
          <p className="text-label text-brand-muted">Your institutional ID</p>
          <p className="mt-2 flex items-center justify-center gap-2 text-h2 font-bold tracking-wide text-brand-primary">
            {institutionId}
            <CopyButton value={institutionId} label="institutional ID" />
          </p>
          <p className="mt-2 text-caption text-brand-muted">Keep this ID safe. It identifies your institution.</p>
        </div>
        <p className="text-center text-caption text-brand-muted">
          Use this ID to sign in on the{' '}
          <Link to="/admin/login" className="font-semibold text-brand-primary underline">Administration login</Link>.
        </p>
      </div>
    )
  }

  const left = sent ? Math.max(0, Math.ceil((sent.expiresAt - now) / 1000)) : 0
  const wait = sent ? Math.max(0, Math.ceil((sent.resendAt - now) / 1000)) : 0

  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-5">
        <Input label="Official institution email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
