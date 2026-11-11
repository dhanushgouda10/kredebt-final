import { Button } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-surface-page px-5 py-16 text-center">
      <p className="text-label text-brand-accent">404</p>
      <h1 className="text-h2 mt-3 font-bold text-brand-primary">Page not found</h1>
      <p className="text-body-l mt-4 max-w-sm text-brand-muted">
        The page you requested does not exist or may have moved.
      </p>
      <Button to="/" variant="accent" size="lg" className="mt-8">
        Back to home
      </Button>
    </div>
  )
}
