/** Neutral institution emblem (columned building in a roundel) for the registry portal. Original artwork. */
export function RegistryEmblem({ className = 'h-14 w-14' }) {
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" fill="#0E2A5C" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="#F7941D" strokeWidth="2" />
      <path d="M32 14 16 24h32L32 14z" fill="#fff" />
      <rect x="19" y="27" width="4.5" height="14" fill="#fff" />
      <rect x="29.75" y="27" width="4.5" height="14" fill="#fff" />
      <rect x="40.5" y="27" width="4.5" height="14" fill="#fff" />
      <rect x="15" y="43" width="34" height="4" fill="#fff" />
      <rect x="12" y="48.5" width="40" height="3" fill="#F7941D" />
    </svg>
  )
}
