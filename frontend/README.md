# Kredent — Blockchain Academic Credentials (Frontend)

React + Vite + Tailwind frontend for the Kredent blockchain-based digital degree
certificate system. Students view their certificates, admins issue/revoke them
(wallet-based auth), and employers verify certificates via QR/hash — all
backed by a Spring Boot API (`../backend`) and, eventually, a Soulbound Token
smart contract.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build     # production build
npm run lint      # eslint
```

Set `VITE_API_BASE_URL` in a `.env` file if the backend isn't running on the
default `http://localhost:8080`.

## Project structure

```
src/
  api/               (none — see services/)
  assets/
    images/          Images actually used by components/pages
  components/
    layout/          App shell: Navbar, Footer, MainLayout, AdminLayout,
                     DashboardSidebar, ProtectedRoute (route guard)
    home/            Sections specific to the HomePage (Hero, Info, Flow)
    ui/              Reusable design-system primitives (Button, Input,
                     Card, Badge, Modal, Alert, etc.) — see components/ui/index.js
  context/
    auth-context.js  The React context object (no components — fast-refresh safe)
    AuthContext.jsx  <AuthProvider> — owns auth state, persists to localStorage
    useAuth.js       useAuth() hook for consuming auth state
  pages/             One file per route, wired up in App.jsx
  services/          API calls to the backend (authService.js, ...)
  utils/             Framework-agnostic helper functions (http.js, ...)
  App.jsx            Route definitions
  main.jsx           App entry point (providers + router)
```

### Conventions

- **Pages vs components**: anything mounted directly on a route lives in
  `pages/`. Anything reused across pages, or broken out of a page for
  readability, lives in `components/`.
- **`components/ui`**: the shared visual language (spacing, color, focus
  states). Prefer these over ad-hoc Tailwind classes when building new UI.
- **`services/`**: all `fetch` calls to the backend live here, one file per
  API domain (e.g. `authService.js`). Pages should never call `fetch`
  directly.
- **`utils/`**: small, pure, framework-agnostic helpers (parsing, formatting).
  If a function doesn't touch React or the DOM, it belongs here.
- Admin auth is wallet-address based (MetaMask). Real signature verification
  (proving private-key ownership, not just the address) is planned for the
  blockchain module.

## Tech stack

React 19 · Vite · Tailwind CSS v4 · React Router · Framer Motion
