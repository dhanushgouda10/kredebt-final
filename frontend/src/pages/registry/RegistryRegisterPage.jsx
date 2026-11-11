import { useState } from 'react'
import { Alert, Button, Card, CardHeader, Input, PasswordInput } from '../../components/ui'
import { EmailVerifyForm } from '../../components/registry/EmailVerifyForm'
import { registerCollege } from '../../services/registryService'

const EMPTY = {
  collegeName: '', state: '', district: '', hoiName: '',
  officialEmail: '', contactNumber: '', password: '', confirmPassword: '',
}

function validate(f) {
  const e = {}
  if (f.collegeName.trim().length < 3) e.collegeName = 'Enter the college name.'
  if (!f.state.trim()) e.state = 'Required.'
  if (!f.district.trim()) e.district = 'Required.'
  if (!f.hoiName.trim()) e.hoiName = 'Required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.officialEmail.trim())) e.officialEmail = 'Enter a valid email address.'
  if (!/^\+?[0-9][0-9 -]{7,14}$/.test(f.contactNumber.trim())) e.contactNumber = 'Enter a valid phone number.'
  if (f.password.length < 8) e.password = 'At least 8 characters.'
  else if (f.password.length > 72) e.password = 'At most 72 characters.'
  if (f.confirmPassword !== f.password) e.confirmPassword = 'Passwords do not match.'
  return e
}

export function RegistryRegisterPage() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')
  const [result, setResult] = useState(null)
  const [verified, setVerified] = useState(false)

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }))
    setErrors((er) => ({ ...er, [name]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError('')
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, k.includes('assword') ? v : v.trim()]))
      setResult(await registerCollege(body))
    } catch (err) {
      setServerError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader title={verified ? 'Registration complete' : 'Verify your email'} subtitle={form.collegeName} />
          <div className="space-y-4 p-6">
            {!verified && <Alert variant={result.emailSent ? 'success' : 'warning'}>{result.message}</Alert>}
            <EmailVerifyForm initialEmail={result.email} alreadySent={result.emailSent} onVerified={() => setVerified(true)} />
          </div>
        </Card>
      </div>
    )
  }

  const f = (name, label, extra = {}) => (
    <Input label={label} name={name} value={form[name]} onChange={set(name)} error={errors[name]} required {...extra} />
  )

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader title="Register Institution" subtitle="You will receive your institutional ID once you submit." />
        <form onSubmit={submit} noValidate className="grid gap-5 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">{f('collegeName', 'Institution name')}</div>
          {f('state', 'State')}
          {f('district', 'District')}
          {f('hoiName', 'Head of Institution name')}
          {f('contactNumber', 'Contact number', { type: 'tel', autoComplete: 'tel' })}
          <div className="sm:col-span-2">{f('officialEmail', 'Official institution email', { type: 'email', autoComplete: 'email' })}</div>
          <PasswordInput label="Password" name="password" value={form.password} onChange={set('password')} error={errors.password} required autoComplete="new-password" />
          <PasswordInput label="Confirm password" name="confirmPassword" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} required autoComplete="new-password" />
          <div className="space-y-4 sm:col-span-2">
            {serverError && <Alert variant="error">{serverError}</Alert>}
            <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>Register</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
