import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, CardHeader, Input } from '../../components/ui'
import { PasswordInput } from '../../components/ui'
import {
  approveRegistryInstitution, getRegistryAdminSession, listRegistryInstitutions, listRegistryLogs,
  registryAdminLogin, registryAdminLogout, suspendRegistryInstitution,
} from '../../services/registryService'

const STATUS_VARIANT = { APPROVED: 'bg-green-100 text-green-800', PENDING: 'bg-amber-100 text-amber-800', SUSPENDED: 'bg-red-100 text-red-800' }

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      onLoggedIn(await registryAdminLogin(email.trim(), password))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader title="Registry administrator" subtitle="Sign in to review institutions." />
      <form onSubmit={submit} className="mx-auto max-w-md space-y-5 p-6">
        <Input label="Email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <PasswordInput label="Password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>Sign in</Button>
      </form>
    </Card>
  )
}

function Dashboard({ session, onLogout }) {
  const [rows, setRows] = useState([])
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([listRegistryInstitutions(), listRegistryLogs()])
      setRows(r)
      setLogs(l)
      setError('')
    } catch (err) {
      if (err.status === 401 || err.status === 403) onLogout()
      else setError(err.message)
    }
  }, [onLogout])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { load() }, [load])

  const act = async (fn, id) => {
    setBusyId(id)
    try {
      await fn(id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-brand-primary">Registry administration</h1>
          <p className="text-caption text-brand-muted">Signed in as {session.email}</p>
        </div>
        <Button variant="secondary" onClick={onLogout}>Sign out</Button>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <Card>
        <CardHeader title="Institutions" subtitle="Approval requires a verified official email." />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-caption">
            <thead className="bg-surface-sunken text-micro uppercase tracking-wider text-brand-muted">
              <tr>
                {['ID', 'College', 'Location', 'HOI / email', 'Email verified', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.institutionId} className="border-t border-surface-line align-top">
                  <td className="px-4 py-3 font-semibold">{r.institutionId}</td>
                  <td className="px-4 py-3">{r.collegeName}</td>
                  <td className="px-4 py-3">{r.district}, {r.state}</td>
                  <td className="px-4 py-3">{r.hoiName}<br /><span className="text-brand-muted">{r.officialEmail}</span></td>
                  <td className="px-4 py-3">{r.emailVerified ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-micro font-semibold ${STATUS_VARIANT[r.status] ?? ''}`}>{r.status}</span>
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-4 py-3">
                    {r.status !== 'APPROVED' && (
                      <Button size="sm" variant="primary" disabled={busyId === r.institutionId || !r.emailVerified}
                        onClick={() => act(approveRegistryInstitution, r.institutionId)}>Approve</Button>
                    )}
                    {r.status !== 'SUSPENDED' && (
                      <Button size="sm" variant="secondary" disabled={busyId === r.institutionId}
                        onClick={() => act(suspendRegistryInstitution, r.institutionId)}>Suspend</Button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-brand-muted">No institutions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHeader title="Verification log" subtitle="Most recent events." />
        <ul className="divide-y divide-surface-line">
          {logs.slice(0, 30).map((l) => (
            <li key={l.id} className="flex flex-wrap gap-x-4 px-6 py-3 text-caption">
              <span className="text-brand-muted">{new Date(l.createdAt).toLocaleString()}</span>
              <span className="font-semibold">{l.event}</span>
              <span>{l.institutionId}</span>
              {l.detail && <span className="text-brand-muted">{l.detail}</span>}
            </li>
          ))}
          {logs.length === 0 && <li className="px-6 py-6 text-center text-caption text-brand-muted">No events yet.</li>}
        </ul>
      </Card>
    </div>
  )
}

export function RegistryAdminPage() {
  const [session, setSession] = useState(() => getRegistryAdminSession())
  const logout = useCallback(() => {
    registryAdminLogout()
    setSession(null)
  }, [])
  return session ? <Dashboard session={session} onLogout={logout} /> : <Login onLoggedIn={setSession} />
}
