import { KredentMark } from '../brand/KredentLogo'

const points = [
  'Each certificate is fingerprinted with SHA-256 and recorded on the blockchain.',
  'Scan the QR code or enter the certificate number \u2014 the live on-chain record is checked.',
  'Institutions are verified against an institutional registry before they can issue.',
]

/**
 * About \u2014 editorial two-column layout.
 */
export function InfoSection({ description }) {
  return (
    <section id="about" className="section-padding bg-surface-raised">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 lg:grid-cols-2 lg:gap-20 lg:px-10">
        <div>
          <h2 className="text-h1 font-bold text-brand-primary">
            The Credential Platform
            <span className="mt-0.5 block text-[0.88em] leading-[1.08] text-brand-gold">
              for every institution
            </span>
          </h2>
          <p className="prose-width text-body-l mt-8 text-brand-muted">{description}</p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-brand-primary p-8 text-white sm:p-10">
          <KredentMark className="h-14 w-14" />
          <ul className="mt-8 space-y-5">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-body text-white/85">
                <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-accent" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
