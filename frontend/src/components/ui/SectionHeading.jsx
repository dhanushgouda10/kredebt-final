/**
 * Eyebrow + two-tone display heading + lead paragraph. No scroll animation.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  children,
  tone = 'light',
  align = 'center',
  className = '',
}) {
  const dark = tone === 'dark'
  const centered = align === 'center'

  return (
    <div className={`${centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} ${className}`}>
      {eyebrow && <p className="text-label mb-3 text-mvj-orange">{eyebrow}</p>}

      <h2 className={`text-h1 font-bold ${dark ? 'text-white' : 'text-mvj-navy'}`}>
        {title}
        {accent && (
          <span className="mt-0.5 block text-[0.88em] leading-[1.08] text-mvj-gold">{accent}</span>
        )}
      </h2>

      {children && (
        <p
          className={`prose-width text-body-l mt-6 ${dark ? 'text-white/80' : 'text-mvj-muted'} ${
            centered ? 'mx-auto' : ''
          }`}
        >
          {children}
        </p>
      )}
    </div>
  )
}
