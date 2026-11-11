import { Button } from '../ui'

const steps = [
  { title: 'Enter your institutional ID', body: 'Kredent looks up your college in the institutional registry and shows its registered details.' },
  { title: 'Confirm by email', body: 'A one-time code goes to the registered head-of-institution email. Nobody can substitute another address.' },
  { title: 'Connect your wallet', body: 'Link the institution’s MetaMask wallet, then issue and revoke certificates from your own dashboard.' },
]

/** Institution onboarding pitch. Replaces the old single-campus photography band. */
export function InstitutionsSection() {
  return (
    <section className="section-padding bg-brand-primary text-white">
      <div className="mx-auto grid max-w-[1200px] items-start gap-14 px-5 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:px-10">
        <div>
          <p className="text-label text-brand-accent">For colleges &amp; universities</p>
          <h2 className="text-h1 mt-4 font-bold">
            Join Kredent
            <span className="mt-0.5 block text-[0.88em] leading-[1.08] text-brand-gold">in three steps</span>
          </h2>
          <p className="prose-width text-body-l mt-6 text-white/75">
            Any institution registered in the institutional registry can verify itself and start issuing
            blockchain-backed certificates the same day.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button to="/admin/login" variant="accent" size="lg">
              Verify your institution
            </Button>
            <Button
              to="/registry"
              variant="outline"
              size="lg"
              className="!border-white/40 !text-white hover:!bg-white hover:!text-brand-primary"
            >
              Institutional registry
            </Button>
          </div>
        </div>

        <ol className="space-y-5">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-5 rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-accent text-body font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="text-h3 font-bold">{step.title}</h3>
                <p className="text-body mt-2 text-white/70">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
