import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Test files are transformed by esbuild rather than the React plugin, so the
  // automatic JSX runtime has to be requested explicitly — otherwise JSX inside
  // *.test.jsx compiles to React.createElement and fails with "React is not defined".
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Only our own tests — without this Vitest will happily walk node_modules.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
