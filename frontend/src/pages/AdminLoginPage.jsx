import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { loginAdmin, registerInstitutionWallet, isMetaMaskAvailable } from '../services/adminWalletAuth'
import {
  lookupInstitution,
  sendInstitutionOtp,
  verifyInstitutionOtp,
} from '../services/institutionService'
import { useAuth } from '../context/useAuth'
import { Alert, Button, Card, CardHeader, Input, PageHeader } from '../components/ui'
import { InstitutionDetails } from '../components/institution/InstitutionDetails'
import { OtpInput } from '../components/institution/OtpInput'
import { Stepper } from '../components/institution/Stepper'

const STEPS = ['Institution', 'Verify email', 'Connect wallet']

const capabilities = [
  'Verify your institution against the institutional registry',
  'Upload a signed degree PDF and stamp a verification QR onto it',
  'Record the SHA-256 hash on the blockchain with your institution’s wallet',
  'Revoke certificates on-chain — visible to verifiers immediately',
  'Every issuance and revocation is written to the audit log',
]

/** Turns a backend error into something the user can act on. */
function describeError(err) {
  const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
  switch (err?.code) {
    case 'INSTITUTION_NOT_FOUND':
      return { variant: 'error', title: 'Institutional ID not found', message, registryLink: true }
    case 'INSTITUTION_PENDING':
      return { variant: 'warning', title: 'Email not verified', message }
    case 'INSTITUTION_SUSPENDED':
      return { variant: 'error', title: 'Institution suspended', message }
    case 'INSTITUTION_NOT_REGISTERED':
    case 'INSTITUTION_NOT_VERIFIED':
      return { variant: 'warning', title: 'Verification needed', message, needsVerification: true }
    case 'ALREADY_REGISTERED':
      return { variant: 'info', title: 'Already registered', message }
    default:
      return { variant: 'error', title: null, message }
  }
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ErrorBanner({ error, onVerifyFirst }) {
  if (!error) return null
  return (
    <Alert variant={error.variant} title={error.title ?? undefined}>
      <p>{error.message}</p>
      {error.registryLink && (
        <p className="mt-2">
          <Link to="/registry/register" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
            Register in the institutional registry
          </Link>
        </p>
      )}
      {error.needsVerification && onVerifyFirst && (
        <p className="mt-2">
          <button type="button" onClick={onVerifyFirst} className="font-semibold underline underline-offset-2">
            Start first-time verification
          </button>
        </p>
      )}
    </Alert>
  )
}

export function AdminLoginPage() {
  const { login, isAuthenticated, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState('verify') // 'verify' (first time) | 'signin'
  const [step, setStep] = useState(0) // 0 institution, 1 otp, 2 wallet, 3 done
  const [institutionId, setInstitutionId] = useState('')
  const [details, setDetails] = useState(null)
  const [session, setSession] = useState(null) // { sessionId, maskedEmail, expiresAt, resendAt }
  const [otp, setOtp] = useState('')
  const [registered, setRegistered] = useState(null) // auth response after the wallet step
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const notice = location.state?.notice

  // Countdown for the OTP step.
  useEffect(() => {
    if (step !== 1) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [step])

  if (isAuthenticated && role === 'ADMIN' && step !== 3) {
    return <Navigate to="/admin/issue-degree" replace />
  }

  const switchMode = (next) => {
    setMode(next)
    setStep(0)
    setDetails(null)
    setSession(null)
    setOtp('')
    setError(null)
  }

  const resetFlow = () => {
    setStep(0)
    setDetails(null)
    setSession(null)
    setOtp('')
    setError(null)
  }

  // ---- first-time verification -------------------------------------------------------------

  const handleLookup = async (e) => {
    e.preventDefault()
    setError(null)
    if (!institutionId.trim()) {
      setError({ variant: 'error', message: 'Enter your institutional ID.' })
      return
    }
    setBusy(true)
    try {
      setDetails(await lookupInstitution(institutionId))
    } catch (err) {
      setDetails(null)
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const startOtp = async () => {
    setError(null)
    setBusy(true)
    try {
      const sent = await sendInstitutionOtp(details.institutionId)
      const sentAt = Date.now()
      setSession({
        sessionId: sent.sessionId,
        maskedEmail: sent.maskedEmail,
        expiresAt: sentAt + sent.expiresInSeconds * 1000,
        resendAt: sentAt + sent.resendAvailableInSeconds * 1000,
      })
      setNow(sentAt)
      setOtp('')
      setStep(1)
    } catch (err) {
      const info = describeError(err)
      if (err?.code === 'RESEND_COOLDOWN' && err.retryAfterSeconds && session) {
        setSession({ ...session, resendAt: Date.now() + err.retryAfterSeconds * 1000 })
      }
      setError(info)
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setError({ variant: 'error', message: 'Enter the 6-digit code.' })
      return
    }
    setError(null)
    setBusy(true)
    try {
      await verifyInstitutionOtp(session.sessionId, otp)
      setOtp('')
      setStep(2)
    } catch (err) {
      setOtp('')
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleConnectWallet = async () => {
    setError(null)
    setBusy(true)
    try {
      const authResponse = await registerInstitutionWallet(session.sessionId)
      login(authResponse)
      setRegistered(authResponse)
      setStep(3)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  // ---- returning administrators -------------------------------------------------------------

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError(null)
    if (!institutionId.trim()) {
      setError({ variant: 'error', message: 'Enter your institutional ID.' })
      return
    }
    setBusy(true)
    try {
      const authResponse = await loginAdmin(institutionId.trim())
      login(authResponse)
      navigate('/admin/issue-degree')
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const otpSecondsLeft = session ? Math.max(0, Math.ceil((session.expiresAt - now) / 1000)) : 0
  const resendSecondsLeft = session ? Math.max(0, Math.ceil((session.resendAt - now) / 1000)) : 0
  const metaMaskMissing = !isMetaMaskAvailable()

  return (
    <section className="min-h-screen bg-surface-page section-padding !pt-14 !pb-16 lg:!pt-20">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <PageHeader
          align="center"
          eyebrow="For institutions"
          title="Institution portal"
          subtitle="Verify your college or university, then issue and revoke blockchain-backed certificates."
        />

        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-8">
            <div className="border-l-4 border-brand-accent pl-6">
              <h2 className="text-h3 font-bold text-brand-primary">What this portal does</h2>
              <p className="text-body-l mt-4 text-brand-muted">
                Kredent is the credential registry for every verified institution. Only an administrator
                connects a wallet &mdash; students never touch MetaMask.
              </p>
            </div>

            <ul className="space-y-3">
              {capabilities.map((item) => (
                <li key={item} className="flex gap-3 text-body text-brand-ink">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-accent" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <Alert variant="info" title="Security notice">
              Only institutions registered in the institutional registry with a verified email can be verified here. The one-time
              code is sent to the registered head-of-institution email &mdash; it cannot be redirected. All actions
              are recorded in the audit log and on-chain where applicable.
            </Alert>
          </div>

          <Card>
            <CardHeader
              title={mode === 'verify' ? 'Verify your institution' : 'Administrator sign in'}
              subtitle={
                mode === 'verify'
                  ? 'First time on Kredent? Three quick steps.'
                  : 'Already verified? Sign in with your institution’s wallet.'
              }
            />

            <div className="flex border-b border-surface-line" role="tablist" aria-label="Portal mode">
              {[
                ['verify', 'First-time verification'],
                ['signin', 'Sign in'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => switchMode(key)}
                  className={`flex-1 py-3.5 text-caption font-semibold transition-colors ${
                    mode === key
                      ? 'border-b-2 border-brand-accent bg-surface-raised text-brand-primary'
                      : 'bg-surface-sunken text-brand-muted hover:text-brand-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-6 p-5 sm:p-8">
              {notice && <Alert variant="warning">{notice}</Alert>}

              {/* ------------------------------------------------ sign in */}
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-5">
                  <Input
                    label="Institutional ID"
                    name="institutionId"
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                    placeholder="e.g. KR-2026-12345"
                    autoComplete="off"
                    autoCapitalize="characters"
                    hint="The ID your institution is registered under in the institutional registry."
                    required
                  />
                  <p className="text-caption text-brand-muted">
                    MetaMask will ask you to connect and sign a message with the wallet linked to your
                    institution. Signing costs no gas.
                  </p>
                  {metaMaskMissing && (
                    <Alert variant="warning">MetaMask was not detected in this browser. Install the extension to continue.</Alert>
                  )}
                  <ErrorBanner error={error} onVerifyFirst={() => switchMode('verify')} />
                  <Button type="submit" variant="accent" size="lg" fullWidth loading={busy}>
                    {busy ? 'Waiting for MetaMask…' : 'Sign in with MetaMask'}
                  </Button>
                </form>
              )}

              {/* ------------------------------------------------ first-time verification */}
              {mode === 'verify' && (
                <>
                  <Stepper steps={STEPS} current={Math.min(step, STEPS.length)} />

                  {step === 0 && (
                    <form onSubmit={handleLookup} className="space-y-5">
                      <Input
                        label="Institutional ID"
                        name="institutionId"
                        value={institutionId}
                        onChange={(e) => {
                          setInstitutionId(e.target.value)
                          setDetails(null)
                          setError(null)
                        }}
                        placeholder="e.g. KR-2026-12345"
                        autoComplete="off"
                        autoCapitalize="characters"
                        required
                      />

                      {!details && (
                        <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>
                          Find my institution
                        </Button>
                      )}

                      <ErrorBanner error={error} />

                      {details && (
                        <div className="space-y-5">
                          <InstitutionDetails details={details} />
                          {details.alreadyRegistered ? (
                            <Alert variant="info" title="Already registered on Kredent">
                              This institution has already completed verification.{' '}
                              <button type="button" onClick={() => switchMode('signin')} className="font-semibold underline underline-offset-2">
                                Sign in instead
                              </button>
                              .
                            </Alert>
                          ) : (
                            <>
                              <p className="text-caption text-brand-muted">
                                We&rsquo;ll send a 6-digit code to the registered head-of-institution email shown
                                above. This address comes from the registry and can&rsquo;t be changed here.
                              </p>
                              <Button type="button" variant="accent" size="lg" fullWidth loading={busy} onClick={startOtp}>
                                Send verification code
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </form>
                  )}

                  {step === 1 && session && (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                      <div>
                        <h3 className="text-h3 font-bold text-brand-primary">Enter the verification code</h3>
                        <p className="mt-2 text-caption text-brand-muted">
                          We sent a 6-digit code to <strong className="text-brand-ink">{session.maskedEmail}</strong> for{' '}
                          <strong className="text-brand-ink">{details?.name}</strong>.
                        </p>
                      </div>

                      <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(null) }} disabled={busy} hasError={Boolean(error)} autoFocus />

                      <p className={`text-center text-caption font-semibold ${otpSecondsLeft === 0 ? 'text-brand-danger' : 'text-brand-muted'}`} aria-live="polite">
                        {otpSecondsLeft > 0 ? `Code expires in ${formatClock(otpSecondsLeft)}` : 'This code has expired — request a new one.'}
                      </p>

                      <ErrorBanner error={error} />

                      <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} disabled={otp.length !== 6 || otpSecondsLeft === 0}>
                        Verify code
                      </Button>

                      <div className="flex flex-col items-center justify-between gap-2 text-caption sm:flex-row">
                        <button
                          type="button"
                          onClick={startOtp}
                          disabled={busy || resendSecondsLeft > 0}
                          className="font-semibold text-brand-accent underline underline-offset-2 disabled:cursor-not-allowed disabled:text-brand-muted disabled:no-underline"
                        >
                          {resendSecondsLeft > 0 ? `Resend code in ${resendSecondsLeft}s` : 'Resend code'}
                        </button>
                        <button type="button" onClick={resetFlow} className="text-brand-muted underline underline-offset-2 hover:text-brand-ink">
                          Use a different institution
                        </button>
                      </div>
                    </form>
                  )}

                  {step === 2 && (
                    <div className="space-y-5">
                      <Alert variant="success" title="Email verified">
                        {details?.name} is now verified. One last step: connect the administrator wallet.
                      </Alert>
                      <p className="text-caption text-brand-muted">
                        MetaMask will ask you to connect and sign a message that proves you control the wallet. It
                        costs no gas and authorises no transaction. Several colleges
                        may use the same MetaMask wallet.
                      </p>
                      {metaMaskMissing && (
                        <Alert variant="warning">MetaMask was not detected in this browser. Install the extension to continue.</Alert>
                      )}
                      <ErrorBanner error={error} />
                      <Button type="button" variant="accent" size="lg" fullWidth loading={busy} onClick={handleConnectWallet}>
                        {busy ? 'Waiting for MetaMask…' : 'Connect MetaMask'}
                      </Button>
                    </div>
                  )}

                  {step === 3 && registered && (
                    <div className="space-y-5">
                      <Alert variant="success" title="Institution registered">
                        {registered.institution?.name} is ready to issue certificates on Kredent.
                      </Alert>
                      {registered.institution?.walletAddress && (
                        <div className="rounded-xl border border-surface-line bg-surface-page px-4 py-3">
                          <p className="text-micro font-semibold uppercase tracking-wider text-brand-muted">Linked wallet</p>
                          <p className="text-mono mt-1 break-all text-brand-ink">{registered.institution.walletAddress}</p>
                        </div>
                      )}
                      <Button type="button" variant="accent" size="lg" fullWidth onClick={() => navigate('/admin/issue-degree')}>
                        Open institution dashboard
                      </Button>
                    </div>
                  )}
                </>
              )}

              <p className="border-t border-surface-line pt-5 text-center text-caption text-brand-muted">
                Not in the registry yet?{' '}
                <Link to="/registry/register" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-primary underline underline-offset-2">
                  Register your institution
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
