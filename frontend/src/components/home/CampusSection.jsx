import campusImage from '../../assets/images/mvjce-campus-institution.png'

/**
 * Full-bleed campus photography — static overlay, no parallax.
 */
export function CampusSection() {
  return (
    <section className="relative isolate min-h-[420px] overflow-hidden bg-mvj-navy sm:min-h-[480px] lg:min-h-[520px]">
      <img
        src={campusImage}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover object-center"
        aria-hidden="true"
      />

      <div className="absolute inset-0 bg-mvj-navy/72" aria-hidden="true" />

      <div className="relative section-padding">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
          <div className="max-w-xl">
            <p className="text-label text-mvj-orange">An autonomous institution</p>
            <h2 className="text-h1 mt-4 font-bold text-white">
              MVJ
              <span className="mt-0.5 block text-[0.88em] leading-[1.08] text-mvj-gold">
                College of Engineering
              </span>
            </h2>
            <p className="prose-width text-body-l mt-6 text-white/80">
              Established in 1982, MVJCE is an autonomous engineering college in Whitefield, Bangalore.
              Kredent is its official digital credential registry — the registrar&rsquo;s office, online.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
