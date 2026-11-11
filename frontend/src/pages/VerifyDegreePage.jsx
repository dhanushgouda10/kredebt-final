import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Input } from '../components/ui'

export function VerifyDegreePage() {
  const [certificateNumber, setCertificateNumber] = useState('')
  const [formError, setFormError] = useState('')
  const navigate = useNavigate()

  const onSubmit = (e) => {
    e.preventDefault()
    const trimmed = certificateNumber.trim()
    if (!trimmed) {
      setFormError('Enter a certificate number to continue.')
      return
    }
    setFormError('')
    navigate(`/verify/${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="bg-brand-primary section-padding !pb-12 !pt-14">
        <div className="mx-auto max-w-2xl px-5 lg:px-10">
          <p className="text-label text-brand-accent">Public verification</p>
          <h1 className="text-h2 mt-3 font-bold text-white">Verify a degree certificate</h1>
          <p className="text-body-l mt-4 text-white/80">
            Confirm whether a certificate was issued by an institution on Kredent and whether it is still valid. The
            platform reads the live blockchain record — not just the database.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-12 lg:px-10">
        <form onSubmit={onSubmit} className="space-y-6 border-t border-surface-line pt-10">
          <Input
            label="Certificate number"
            value={certificateNumber}
            onChange={(e) => setCertificateNumber(e.target.value)}
            placeholder="e.g. CERT-2026-0001"
            autoComplete="off"
            autoCapitalize="characters"
            required
            hint="Printed on the certificate, next to the QR code."
          />

          {formError && <Alert variant="error">{formError}</Alert>}

          <Button type="submit" variant="accent" size="lg">
            Verify certificate
          </Button>
        </form>

        <p className="text-body mt-10 text-brand-muted">
          Every Kredent certificate carries a QR code. Scanning it with a phone camera opens this check
          automatically — you do not need to type the number.
        </p>
      </div>
    </div>
  )
}
