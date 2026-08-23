import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  )
}

/**
 * Modal shell with focus trap, Escape-to-close, and focus restoration.
 * Controlled by the `open` prop; iframe consumers should unmount inner content
 * on close so media always stops.
 */
export function Modal({ open, onClose, title, children, size = 'lg' }) {
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
        return
      }

      if (e.key !== 'Tab' || !dialogRef.current) return

      const focusable = getFocusable(dialogRef.current)
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    const focusable = dialogRef.current ? getFocusable(dialogRef.current) : []
    const toFocus = focusable.find((el) => el.getAttribute('aria-label') === 'Close dialog') ?? focusable[0]
    toFocus?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (triggerRef.current?.focus) triggerRef.current.focus()
    }
  }, [open, onClose])

  const maxWidth = size === 'md' ? 'max-w-lg' : size === 'sm' ? 'max-w-md' : 'max-w-2xl'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            ref={dialogRef}
            initial={{ scale: 0.97, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-label={typeof title === 'string' ? title : undefined}
            className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-xl bg-surface-raised shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between bg-mvj-navy p-6 text-white">
                <h3 id="modal-title" className="heading-serif text-h3 text-white">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
