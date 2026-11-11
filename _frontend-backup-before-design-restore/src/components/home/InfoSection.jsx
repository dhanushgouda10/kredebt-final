const points = [
  {
    title: 'Tamper-evident',
    body: 'Each certificate is fingerprinted with SHA-256 and the record is written to the blockchain. Change a single pixel and verification fails.',
  },
  {
    title: 'Instant to verify',
    body: 'Scan the QR code on the certificate or enter its number. The live on-chain record is checked — not a screenshot, not an email.',
  },
  {
    title: 'Built for every institution',
    body: 'Colleges are verified against an institutional registry before they can issue, so only genuine institutions appear on Kredent.',
  },
]

/** Why Kredent — three product principles instead of institution imagery. */
export function InfoSection({ description }) {
  return (
    <section id="about" className="section-padding bg-surface-raised">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
        <div className="max-w-3xl">
          <h2 className="text-h1 font-bold text-brand-primary">
            One trusted layer for
            <span className="mt-0.5 block text-[0.88em] leading-[1.08] text-brand-accent">every academic credential</span>
          </h2>
          <p className="prose-width text-body-l mt-8 text-brand-muted">{description}</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {points.map((point) => (
            <div key={point.title} className="rounded-2xl border border-surface-line bg-surface-page p-7">
              <span className="mb-5 block h-1 w-10 rounded-full bg-brand-accent" aria-hidden="true" />
              <h3 className="text-h3 font-bold text-brand-primary">{point.title}</h3>
              <p className="text-body mt-3 text-brand-muted">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
