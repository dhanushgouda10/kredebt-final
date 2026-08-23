import { useState } from 'react'
import { Label } from './Input'

const BASE =
  'w-full rounded-lg border bg-surface-raised px-4 py-3 pr-11 text-caption text-mvj-ink placeholder:text-mvj-muted/60 transition duration-150 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-mvj-muted'

const STATE = {
  default: 'border-surface-line-strong focus:border-mvj-navy focus:ring-mvj-navy/20',
  error: 'border-red-400 focus:border-red-500 focus:ring-red-500/25',
}

/**
 * Password field with a show/hide toggle. Same prop contract as a native
 * <input type="password">, so it's a drop-in replacement.
 */
export function PasswordInput({ label, id, required, error, className = '', containerClassName = '', ...rest }) {
  const [visible, setVisible] = useState(false)
  const inputId = id ?? rest.name

  return (
    <div className={containerClassName}>
      {label && (
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={Boolean(error)}
          className={`${BASE} ${error ? STATE.error : STATE.default} ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={0}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-mvj-muted/75 transition hover:bg-surface-sunken hover:text-mvj-muted"
        >
          {visible ? (
            <svg className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.343 6.343m3.535 3.535L21 21m-6.879-6.879L6.343 6.343" />
            </svg>
          ) : (
            <svg className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-micro font-medium text-red-600">{error}</p>}
    </div>
  )
}
