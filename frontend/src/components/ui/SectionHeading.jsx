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
      {eyebrow && <p className="text-label mb-3 text-brand-accent">{eyebrow}</p>}

      <h2 className={`text-h1 font-bold ${dark ? 'text-white' : 'text-brand-primary'}`}>
        {title}
        {accent && (
          <span className="mt-0.5 block text-[0.88em] leading-[1.08] text-brand-gold">{accent}</span>
        )}
      </h2>

      {children && (
        <p
          className={`prose-width text-body-l mt-6 ${dark ? 'text-white/80' : 'text-brand-muted'} ${
            centered ? 'mx-auto' : ''
          }`}
        >
          {children}
        </p>
      )}
    </div>
  )
}
