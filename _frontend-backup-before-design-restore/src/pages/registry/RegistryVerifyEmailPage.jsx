import { useSearchParams } from 'react-router-dom'
import { Card, CardHeader } from '../../components/ui'
import { EmailVerifyForm } from '../../components/registry/EmailVerifyForm'

export function RegistryVerifyEmailPage() {
  const [params] = useSearchParams()
  return (
    <Card>
      <CardHeader title="Verify official email" subtitle="Required before the registry administrator can approve." />
      <div className="p-6">
        <EmailVerifyForm initialId={params.get('id') ?? ''} />
      </div>
    </Card>
  )
}
