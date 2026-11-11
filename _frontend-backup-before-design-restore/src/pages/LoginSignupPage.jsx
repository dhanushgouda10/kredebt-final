import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listPublicDepartments, loginStudent, registerStudent } from '../services/authService'
import { useAuth } from '../context/useAuth'
import { Alert, Button, Input, PasswordInput, Select } from '../components/ui'
import { normalizeEmail, validateEmail } from '../utils/email'
import { KredentLogo } from '../components/brand/KredentLogo'

export function LoginSignupPage() {
  const [activeTab, setActiveTab] = useState('register')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [departments, setDepartments] = useState([])
  const [departmentsError, setDepartmentsError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    usn: '',
    email: '',
    mobile: '',
    department: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  })
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    let cancelled = false
    listPublicDepartments()
      .then((list) => {
        if (!cancelled) setDepartments(list)
      })
      .catch((err) => {
        if (!cancelled) setDepartmentsError(err.message || 'Could not load departments')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormError(null)
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (activeTab === 'register') {
      // Same email check the admin create form applies; the backend validates it independently.
      const emailError = validateEmail(formData.email)
      if (emailError) {
        setFormError(emailError)
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setFormError('Passwords do not match.')
        return
      }
      setSubmitting(true)
      try {
        await registerStudent({
          fullName: formData.name.trim(),
          usn: formData.usn.trim(),
          email: normalizeEmail(formData.email),
          phone: formData.mobile.trim(),
          department: formData.department,
          password: formData.password,
        })
        setActiveTab('login')
        setFormError(null)
        setFormData((prev) => ({
          ...prev,
          password: '',
          confirmPassword: '',
        }))
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Registration failed.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    setSubmitting(true)
    try {
      const authResponse = await loginStudent({
        email: formData.email.trim(),
        password: formData.password,
      })
      login(authResponse)
      navigate('/student/dashboard')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex flex-col items-center gap-3">
            <KredentLogo markClassName="h-12 w-12" />
            <h1 className="text-label text-brand-muted">Student Portal</h1>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-surface-line bg-surface-raised">
          <div className="flex border-b border-surface-line">
            <button
              type="button"
              onClick={() => {
                setFormError(null)
                setActiveTab('register')
              }}
              className={`flex-1 py-4 text-center text-caption font-semibold transition-colors ${
                activeTab === 'register' ? 'bg-brand-accent text-white' : 'bg-surface-sunken text-brand-muted hover:text-brand-ink'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null)
                setActiveTab('login')
              }}
              className={`flex-1 py-4 text-center text-caption font-semibold transition-colors ${
                activeTab === 'login' ? 'bg-brand-accent text-white' : 'bg-surface-sunken text-brand-muted hover:text-brand-ink'
              }`}
            >
              Login
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {activeTab === 'register' ? (
                <>
                  <Input label="Full name" name="name" value={formData.name} onChange={handleInputChange} required />
                  <Input label="USN" name="usn" value={formData.usn} onChange={handleInputChange} required />
                  <Input label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                  <Input label="Mobile" name="mobile" type="tel" value={formData.mobile} onChange={handleInputChange} required />
                  <Select
                    label="Department"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                    disabled={departments.length === 0}
                  >
                    <option value="">Select department</option>
                    {departments.map((dept) => (
                      <option key={dept.code} value={dept.code}>
                        {dept.label ?? dept.code}
                      </option>
                    ))}
                  </Select>
                  {departmentsError && <Alert variant="error">{departmentsError}</Alert>}
                  <PasswordInput label="Password" name="password" value={formData.password} onChange={handleInputChange} required />
                  <PasswordInput
                    label="Confirm password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                  />
                  <label className="flex items-start gap-3 text-body text-brand-muted">
                    <input
                      type="checkbox"
                      name="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={handleInputChange}
                      required
                      className="mt-1"
                    />
                    I agree to the Kredent terms of service
                  </label>
                </>
              ) : (
                <>
                  <Input label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                  <PasswordInput label="Password" name="password" value={formData.password} onChange={handleInputChange} required />
                </>
              )}

              {formError && <Alert variant="error">{formError}</Alert>}

              <Button type="submit" variant="accent" size="lg" fullWidth loading={submitting}>
                {activeTab === 'register' ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-6 text-center text-caption text-brand-muted">
              <Link to="/" className="font-semibold text-brand-danger underline underline-offset-2 hover:text-brand-primary">
                Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
