import { useRef } from 'react'

/**
 * Six-box one-time-code entry: digits only, auto-advance, backspace-aware and paste-friendly.
 * The value lives in the parent; this component never stores, logs or transmits it.
 */
export function OtpInput({ value, onChange, length = 6, disabled = false, hasError = false, autoFocus = false }) {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')
  const focusBox = (i) => refs.current[Math.max(0, Math.min(i, length - 1))]?.focus()

  const handleChange = (i, raw) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (!digit) return
    onChange((value.slice(0, i) + digit + value.slice(i + 1)).slice(0, length))
    focusBox(i + 1)
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const idx = digits[i] ? i : i - 1
      if (idx >= 0) {
        onChange(value.slice(0, idx) + value.slice(idx + 1))
        focusBox(idx)
      }
    } else if (e.key === 'ArrowLeft') {
      focusBox(i - 1)
    } else if (e.key === 'ArrowRight') {
      focusBox(i + 1)
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted)
    focusBox(pasted.length)
  }

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label="Six digit verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => {
            // never leave gaps: jump to the first empty box
            if (i > value.length) focusBox(value.length)
            else e.target.select()
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={hasError}
          className={`h-12 w-full min-w-0 rounded-lg border bg-surface-raised text-center font-mono text-xl font-bold text-brand-ink transition focus:outline-none focus:ring-2 sm:h-14 sm:text-2xl ${
            hasError
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25'
              : 'border-surface-line-strong focus:border-brand-primary focus:ring-brand-primary/20'
          } disabled:bg-surface-sunken`}
        />
      ))}
    </div>
  )
}
