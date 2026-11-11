import { Link } from 'react-router-dom'
import { Alert, Button, Card } from '../../components/ui'

export function RegistryHomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h2 font-bold text-brand-primary">Demo Institutional Registry</h1>
        <p className="text-body-l mt-3 max-w-2xl text-brand-muted">
          A simulated registry used to demonstrate how Kredent verifies an institution before it may issue
          certificates. Register a college, verify its email, and have the registry administrator approve it.
        </p>
      </div>
      <Alert variant="info" title="How the demo works">
        Register &rarr; verify the official email &rarr; registry admin approves &rarr; the college verifies itself on
        Kredent with a one-time code sent to the registered head-of-institution email.
      </Alert>
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          ['Register a college', 'Create an institution record with a unique ID and official email.', '/registry/register'],
          ['Verify email', 'Confirm the official email with a one-time code.', '/registry/verify-email'],
          ['Registry admin', 'Review, approve or suspend institutions.', '/registry/admin'],
        ].map(([title, text, to]) => (
          <Card key={to}>
            <div className="flex h-full flex-col gap-3 p-6">
              <h2 className="text-h3 font-bold text-brand-primary">{title}</h2>
              <p className="flex-1 text-caption text-brand-muted">{text}</p>
              <Link to={to}><Button variant="primary" fullWidth>Open</Button></Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
