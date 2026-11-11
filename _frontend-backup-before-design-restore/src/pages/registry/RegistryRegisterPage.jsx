import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, CardHeader, Input } from '../../components/ui'
import { PasswordInput } from '../../components/ui'
import { EmailVerifyForm } from '../../components/registry/EmailVerifyForm'
import { registerCollege } from '../../services/registryService'

const EMPTY = {
  collegeName: '', institutionId: '', state: '', district: '', hoiName: '',
  officialEmail: '', contactNumber: '', password: '', confirmPassword: '',
}

function validate(f) {
  const e = {}
  if (f.collegeName.trim().length < 3) e.collegeName = 'Enter the college name.'
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{3,31}$/.test(f.institutionId.trim())) e.institutionId = '4-32 characters: letters, digits, hyphens.'
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
      <Card>
        <CardHeader title="Verify the official email" subtitle={`${form.collegeName} — status: ${result.status}`} />
        <div className="space-y-5 p-6">
          <Alert variant="success">{result.message}</Alert>
          {!result.emailSent && (
            <Alert variant="warning">The verification email could not be sent automatically. Use the form below to request it again.</Alert>
          )}
          <EmailVerifyForm initialId={result.institutionId} alreadySent={result.emailSent} />
          <p className="text-caption text-brand-muted">
            After the email is verified, the registry administrator must approve the institution before it can verify
            itself on Kredent. <Link to="/admin/login" className="font-semibold underline">Go to Kredent</Link>
          </p>
        </div>
      </Card>
    )
  }

  const f = (name, label, extra = {}) => (
    <Input label={label} name={name} value={form[name]} onChange={set(name)} error={errors[name]} required {...extra} />
  )

  return (
    <Card>
      <CardHeader title="Register a college" subtitle="Creates a PENDING record in the demo registry." />
      <form onSubmit={submit} noValidate className="grid gap-5 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">{f('collegeName', 'College name')}</div>
        {f('institutionId', 'Institutional ID (Demo AICTE PID)', { placeholder: 'e.g. DEMO-4001', autoComplete: 'off' })}
        {f('hoiName', 'Head of Institution (HOI) name')}
        {f('state', 'State')}
        {f('district', 'District')}
        {f('officialEmail', 'Official college email', { type: 'email', autoComplete: 'email' })}
        {f('contactNumber', 'Contact number', { type: 'tel', autoComplete: 'tel' })}
        <PasswordInput label="Password" name="password" value={form.password} onChange={set('password')} error={errors.password} required autoComplete="new-password" />
        <PasswordInput label="Confirm password" name="confirmPassword" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} required autoComplete="new-password" />
        <div className="space-y-4 sm:col-span-2">
          {serverError && <Alert variant="error">{serverError}</Alert>}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>Register college</Button>
        </div>
      </form>
    </Card>
  )
}
