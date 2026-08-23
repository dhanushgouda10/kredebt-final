import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Unmount rendered trees between tests so DOM state never leaks across cases.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// jsdom implements neither of these, and both are used by components under test
// (Framer Motion's reduced-motion check, and the hero's viewport query).
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
