import { SectionHeading } from '../ui'

const steps = [
  {
    title: 'Issue',
    description:
      'A verified institution’s authorised staff upload a signed degree certificate through the Kredent administration portal.',
  },
  {
    title: 'Secure',
    description:
      'A verification QR is stamped onto the PDF, a SHA-256 fingerprint is computed of the finished document, and that record is written to the Polygon network.',
  },
  {
    title: 'Verify',
    description:
      'Anyone scans the QR code or enters the certificate number. The platform reads the live blockchain record and confirms whether the credential is genuine.',
  },
  {
    title: 'Trust',
    description:
      'Revocation is written on-chain and visible immediately. Every administrative action is recorded in the audit log.',
  },
]

export function FlowSection() {
  return (
    <section className="section-padding bg-surface-band">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <SectionHeading eyebrow="How it works" title="From Issuance" accent="to Verification" align="left">
          Four steps from the day an institution signs a certificate to the moment an employer confirms it.
        </SectionHeading>

        <ol className="mt-16 max-w-3xl space-y-10 border-l-2 border-surface-line-strong pl-8">
          {steps.map((step, idx) => (
            <li key={step.title} className="relative">
              <span
                className="absolute -left-[calc(2rem+5px)] top-0.5 text-label text-brand-accent"
                aria-hidden="true"
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <h3 className="text-h3 font-bold text-brand-primary">{step.title}</h3>
              <p className="mt-3 text-body-l text-brand-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
