import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginAdmin } from '../services/adminWalletAuth'
import { useAuth } from '../context/useAuth'
import { Alert, Button, Card, CardHeader, PageHeader } from '../components/ui'

const capabilities = [
  'Upload a signed degree PDF and stamp a verification QR onto it',
  'Record the SHA-256 hash on Polygon Amoy via the admin wallet',
  'Revoke certificates on-chain — visible to verifiers immediately',
  'Every issuance and revocation is written to the audit log',
]

export function AdminLoginPage() {
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const navigate = useNavigate()
  const { login } = useAuth()

  // Connect → request a one-time challenge → sign it in MetaMask → exchange the
  // signature for a session. The sequence lives in services/adminWalletAuth so it
  // can be tested with a mocked wallet; this handler only owns the UI state.
  const handleAdminLogin = async () => {
    setLoginError(null)
    setIsLoggingIn(true)
    try {
      const authResponse = await loginAdmin()
      login(authResponse)
      navigate('/admin/issue-degree')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Could not sign in. Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <section className="min-h-screen bg-surface-page section-padding">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <PageHeader
          align="center"
          eyebrow="MVJ College of Engineering"
          title="Administration"
          subtitle="Authorised college staff only. Sign in with your institutional wallet."
        />

        <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-8">
            <div className="border-l-4 border-mvj-orange pl-6">
              <h2 className="text-h3 font-bold text-mvj-navy">What this portal does</h2>
              <p className="text-body-l mt-4 text-mvj-muted">
                Kredent is the college&rsquo;s credential registry. Only the administrator connects a
                wallet — students never touch MetaMask.
              </p>
            </div>

            <ul className="space-y-4">
              {capabilities.map((item) => (
                <li key={item} className="text-body text-mvj-ink">
                  {item}
                </li>
              ))}
            </ul>

            <Alert variant="info" title="Security notice">
              This portal is restricted to authorised MVJCE personnel. All actions are recorded in the
              audit log and on-chain where applicable.
            </Alert>
          </div>

          <Card>
            <CardHeader title="Admin sign in" subtitle="Connect your institutional wallet" />

            <div className="space-y-6 p-6">
              <p className="text-body text-mvj-muted">
                MetaMask will ask you to connect the wallet registered with the college administration.
              </p>

              <Button variant="accent" size="lg" fullWidth loading={isLoggingIn} onClick={handleAdminLogin}>
                {isLoggingIn ? 'Signing in…' : 'Login as Admin'}
              </Button>

              {loginError && <Alert variant="error">{loginError}</Alert>}

              <p className="border-t border-surface-line pt-5 text-center text-caption text-mvj-muted">
                By signing in, you agree to the MVJCE terms of service.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
