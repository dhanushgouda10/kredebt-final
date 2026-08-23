import aboutImage from '../../assets/images/mvjce-campus-culture.png'

/**
 * About — editorial two-column matching MVJCE "About MVJ / College of Engineering".
 */
export function InfoSection({ description }) {
  return (
    <section id="about" className="section-padding bg-surface-raised">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 lg:grid-cols-2 lg:gap-20 lg:px-10">
        <div>
          <h2 className="text-h1 font-bold text-mvj-navy">
            The Official Credential Platform
            <span className="mt-0.5 block text-[0.88em] leading-[1.08] text-mvj-gold">
              of MVJ College of Engineering
            </span>
          </h2>
          <p className="prose-width text-body-l mt-8 text-mvj-muted">{description}</p>
        </div>

        <div className="overflow-hidden rounded-2xl">
          <img
            src={aboutImage}
            alt="MVJCE students on campus"
            loading="lazy"
            className="aspect-[4/5] w-full object-cover object-center sm:aspect-[3/4] lg:aspect-[4/5]"
          />
        </div>
      </div>
    </section>
  )
}
