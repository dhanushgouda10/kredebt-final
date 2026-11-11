import { useSearchParams } from 'react-router-dom'
import { Card, CardHeader } from '../../components/ui'
import { EmailVerifyForm } from '../../components/registry/EmailVerifyForm'

export function RegistryVerifyEmailPage() {
  const [params] = useSearchParams()
  return (
    <Card>
      <CardHeader title="Verify official email" subtitle="Verify your official email to receive your institutional ID." />
      <div className="p-6">
        <EmailVerifyForm initialEmail={params.get('email') ?? ''} />
      </div>
    </Card>
  )
}
