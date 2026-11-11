import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listColleges, listPublicDepartments, loginStudent, registerStudent } from '../services/authService'
import { useAuth } from '../context/useAuth'
import { Alert, Button, Input, PasswordInput, Select } from '../components/ui'
import { normalizeEmail, validateEmail } from '../utils/email'
import { KredentMark } from '../components/brand/KredentLogo'
import { CollegeSelect } from '../components/student/CollegeSelect'

export function LoginSignupPage() {
  const [activeTab, setActiveTab] = useState('register')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [departments, setDepartments] = useState([])
  const [departmentsError, setDepartmentsError] = useState('')
  const [colleges, setColleges] = useState([])
  const [collegesLoading, setCollegesLoading] = useState(true)
  const [collegesError, setCollegesError] = useState('')
  const [notice, setNotice] = useState('')
  const [formData, setFormData] = useState({
    institutionId: '',
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

  useEffect(() => {
    let cancelled = false
    listColleges()
      .then((list) => {
        if (!cancelled) setColleges(list)
      })
      .catch((err) => {
        if (!cancelled) setCollegesError(err.message || 'Could not load the list of colleges')
      })
      .finally(() => {
        if (!cancelled) setCollegesLoading(false)
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
    setNotice('')

    if (!formData.institutionId) {
      setFormError('Please select your college.')
      return
    }

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
          institutionId: formData.institutionId,
          fullName: formData.name.trim(),
          usn: formData.usn.trim(),
          email: normalizeEmail(formData.email),
          phone: formData.mobile.trim(),
          department: formData.department,
          password: formData.password,
        })
        setActiveTab('login')
        setFormError(null)
        setNotice('Account created. Sign in with your email and password.')
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
        institutionId: formData.institutionId,
        email: normalizeEmail(formData.email),
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
    <div className="flex min-h-screen bg-surface-page">
      <div className="relative hidden w-5/12 shrink-0 lg:block" aria-hidden="true">
        <img
          src="/images/campus-students.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[50%_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/90 via-brand-primary/20 to-transparent" />
        <p className="absolute inset-x-8 bottom-10 text-h2 font-semibold leading-tight text-white">
          Your academic record, verified on blockchain.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-4">
            <KredentMark className="h-14 w-14 sm:h-16 sm:w-16" />
            <div className="text-left">
              <h1 className="text-h2 font-bold text-brand-primary">KREDENT</h1>
              <p className="text-label mt-1 text-brand-muted">Student Portal</p>
            </div>
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
                  <CollegeSelect colleges={colleges} value={formData.institutionId} onChange={handleInputChange} loading={collegesLoading} error={collegesError} />
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
                  <CollegeSelect colleges={colleges} value={formData.institutionId} onChange={handleInputChange} loading={collegesLoading} error={collegesError} />
                  <Input label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                  <PasswordInput label="Password" name="password" value={formData.password} onChange={handleInputChange} required />
                </>
              )}

              {notice && <Alert variant="success">{notice}</Alert>}
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
    </div>
  )
}
