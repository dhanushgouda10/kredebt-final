import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsNarrow(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return isNarrow
}

/**
 * Subtle vertical parallax via Framer Motion scroll progress. Damped below 768px
 * and disabled under prefers-reduced-motion.
 */
export function ParallaxLayer({ children, speed = 0.2, className = '', dampenMobile = true, ...rest }) {
  const ref = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const isNarrow = useIsNarrowViewport()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const effectiveSpeed = dampenMobile && isNarrow ? speed * 0.35 : speed
  const range = 120 * effectiveSpeed
  const y = useTransform(scrollYProgress, [0, 1], [range, -range])

  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className} {...rest}>
        {children}
      </div>
    )
  }

  return (
    <motion.div ref={ref} style={{ y }} className={className} {...rest}>
      {children}
    </motion.div>
  )
}
