import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardHeader, Input, PageHeader, SkeletonLines } from '../../components/ui'
import { getOwnProfile, updateOwnProfile } from '../../services/studentService'

export function StudentProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ fullName: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getOwnProfile()
      .then((data) => {
        setProfile(data)
        setForm({ fullName: data.fullName ?? '', phone: data.phone ?? '' })
        setLoadError('')
      })
      .catch((err) => setLoadError(err.message || 'Could not load your profile'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setSaved(false)
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaveError('')
    setSaved(false)
    setSaving(true)
    try {
      const updated = await updateOwnProfile(form)
      setProfile(updated)
      setSaved(true)
    } catch (err) {
      setSaveError(err.message || 'Could not save your profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="min-h-screen bg-surface-page py-14 sm:py-16">
      <div className="mx-auto max-w-2xl px-5 lg:px-10">
        <PageHeader
          eyebrow="Student portal"
          title="Profile"
          subtitle="Your account details on Kredent."
        />

        {loadError && (
          <Alert variant="error" title="Could not load profile" className="mb-6">
            {loadError}
          </Alert>
        )}

        {loading ? (
          <Card className="p-8">
            <SkeletonLines lines={6} />
          </Card>
        ) : profile ? (
          <Card>
            <CardHeader title="Account Information" />
            <div className="space-y-6 p-6">
              <div className="grid grid-cols-1 gap-4 text-caption sm:grid-cols-2">
                <div>
                  <p className="text-brand-muted">USN</p>
                  <p className="font-mono font-semibold text-brand-ink">{profile.usn}</p>
                </div>
                <div>
                  <p className="text-brand-muted">Email</p>
                  <p className="font-semibold text-brand-ink">{profile.email}</p>
                </div>
                <div>
                  <p className="text-brand-muted">Department</p>
                  <p className="font-semibold text-brand-ink">{profile.department}</p>
                </div>
                <div>
                  <p className="text-brand-muted">System-managed wallet</p>
                  <p className="break-all font-mono text-micro text-brand-ink">
                    {profile.walletAddress || 'Not yet generated'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 border-t border-surface-line pt-6">
                <Input label="Full name" name="fullName" required value={form.fullName} onChange={handleChange} />
                <Input label="Phone" name="phone" required value={form.phone} onChange={handleChange} />

                {saveError && <Alert variant="error">{saveError}</Alert>}
                {saved && <Alert variant="success">Profile updated.</Alert>}

                <Button type="submit" variant="primary" loading={saving}>
                  Save Changes
                </Button>
              </form>
            </div>
          </Card>
        ) : null}
      </div>
    </section>
  )
}
