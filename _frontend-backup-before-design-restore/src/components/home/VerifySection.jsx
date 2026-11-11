import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Input, SectionHeading } from '../ui'

export function VerifySection() {
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
    <section id="verify" className="section-padding bg-surface-raised">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <SectionHeading eyebrow="Verify now" title="Verify an" accent="Academic Credential" align="left">
          Enter the certificate number printed on the document, next to the QR code. No account is required.
        </SectionHeading>

        <form onSubmit={onSubmit} className="mt-12 max-w-xl space-y-4">
          <Input
            label="Certificate number"
            value={certificateNumber}
            onChange={(e) => setCertificateNumber(e.target.value)}
            placeholder="e.g. CERT-2026-0001"
            autoComplete="off"
            autoCapitalize="characters"
            required
          />
          <Button type="submit" variant="accent" size="lg">
            Verify
          </Button>
          {formError && <Alert variant="error">{formError}</Alert>}
        </form>
      </div>
    </section>
  )
}
