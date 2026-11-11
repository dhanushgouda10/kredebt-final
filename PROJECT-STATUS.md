> **Note (Nov 2026):** the MVJCE-specific branding and `@mvjce.edu.in` restriction described below were removed when Kredent became institution-neutral. See README "Institution verification & demo registry".

# Kredent — Project Status

Where the project stands, what has been built, what is verified, and what is left.

**Date:** 20 August 2026
**Legend:** ✅ done & verified · ⚠️ done but not verified · ⬜ not started

---

## 1. Core platform — the original build

| # | Capability | Status |
|---|---|---|
| 1 | Student self-registration + JWT login (BCrypt) | ✅ |
| 2 | Admin wallet login (MetaMask) | ✅ |
| 3 | Role-based authorisation (ADMIN / STUDENT) | ✅ |
| 4 | Certificate PDF upload → Supabase Storage | ✅ |
| 5 | QR code stamped onto the PDF | ✅ |
| 6 | SHA-256 hash taken **after** stamping | ✅ |
| 7 | On-chain issuance (Polygon Amoy, SkillChainCredential) | ✅ |
| 8 | On-chain revocation | ✅ |
| 9 | Public verification reading the **live contract**, not just the DB | ✅ |
| 10 | PDF tamper check (upload a copy, compare hashes) | ✅ |
| 11 | System-managed student wallets (AES-256-GCM encrypted) | ✅ |
| 12 | Audit log of every admin action | ✅ |
| 13 | Department catalogue + server-side pagination/filtering | ✅ |
| 14 | Student portal (dashboard, certificates, detail, profile) | ✅ |
| 15 | Admin portal (students, issue, registry, audit) | ✅ |

---

## 2. Frontend redesign

| Area | What was done | Status |
|---|---|---|
| Design tokens | MVJCE palette sampled from the real site — navy `#0E2A5C`, orange `#F7941D`, red `#CE2A26`, gold `#E9B949`, charcoal `#231F20` | ✅ |
| Warm surfaces | Five-step butter/off-white ramp; **pure `#FFFFFF` removed** as a page/card surface (35 instances) | ✅ |
| Type scale | Real scale in `index.css`; **187 raw Tailwind sizes** consolidated onto it; body text bumped 14px → 15px | ✅ |
| Text colour | 170 cold `gray`/`slate` values → warm `mvj-ink` / `mvj-muted` | ✅ |
| Navbar | MVJCE two-tier structure (logo + navy utility plate, then primary nav) | ✅ |
| Footer | MVJCE three-zone architecture (charcoal contact rail, navy links, blush strip) | ✅ |
| Hero | Real MVJCE campus photo + "Campus Life 2024" video, scroll parallax, reduced-motion aware | ✅ |
| Landing page | Cut from 6 content sections to 5, each answering one question | ✅ |
| Two-tone headings | Navy-over-gold pairing (MVJCE's signature device) across sections | ✅ |
| Verification page | Verdict hoisted to first + largest element; blockchain data behind disclosure | ✅ |
| Student portal | KPI tiles removed; 8-column table → card list; progressive disclosure on detail | ✅ |
| Admin density | Table rows `py-4` → `py-5`, wider form spacing | ✅ |
| Code splitting | `React.lazy` on /admin and /student trees — bundle 786 KB → 440 KB | ✅ |
| Cleanup | Removed fabricated stats, fake cert number, placeholder social links, duplicate scroll-to-top, 4 dead components | ✅ |

**Not done:** per-screen "one accent colour per viewport" pass (needs a human eye).
**Not verified:** none of the visual work has been confirmed in a real browser.

---

## 3. Security hardening

| Item | Status | Note |
|---|---|---|
| Admin signature verification (nonce + `personal_sign` + web3j recovery) | ⚠️ | Frontend ✅ tested · backend written, **not compiled** |
| Single-use, 5-minute, `SecureRandom` nonces | ⚠️ | Backend not compiled |
| Uniform failure messages (no admin-wallet enumeration) | ⚠️ | Backend not compiled |
| Nonce endpoint responds for non-admins too (no oracle) | ⚠️ | Backend not compiled |
| Startup secret validation | ⚠️ | Fatal under `prod`, loud warning otherwise |
| `ADMIN_WALLET_ADDRESS` hardcoded default removed | ⚠️ | **See breaking change below** |
| Production profile (`application-prod.properties`) | ⚠️ | `ddl-auto=validate`, Swagger off, no stack traces |
| Rate limiting on `/api/auth/**` and `/api/verify/**` | ⬜ | Deferred |
| Global `@ControllerAdvice` | ⬜ | Deferred |
| Actuator `/health` | ⬜ | Deferred |
| `csrf.disable()` rationale documented | ⬜ | Deferred |

### The vulnerability this closes

`AdminAuthService.loginWithWallet` previously looked up the submitted wallet address
and issued an ADMIN token if a matching row existed. No signature was ever checked.
Ethereum addresses are public by construction, so **anyone who knew the admin's
address could obtain an admin session** — a complete authentication bypass.

New flow: connect → `GET /nonce` → MetaMask `personal_sign` → `POST /wallet-login`
with `{ walletAddress, signature }` → server recovers the signer and compares →
only then checks admin membership → issues the unchanged JWT.

---

## 4. Email notifications

| Item | Status |
|---|---|
| `@MvjceEmail` constraint on the shared `RegisterRequest` (covers **both** registration paths) | ⚠️ backend not compiled |
| Frontend domain validation on admin create + public signup | ✅ 32 tests passing |
| Email normalised (trim + lowercase) before persistence | ⚠️ backend not compiled |
| `EmailService` / `ResendEmailService` — real Resend HTTP API | ⚠️ backend not compiled |
| Responsive HTML + plain-text templates, no secrets in body | ⚠️ backend not compiled |
| Failure never rolls back registration; `emailSent` reported instead | ⚠️ backend not compiled |
| Admin UI shows whether the email was delivered | ✅ |

**No password is ever emailed.** None is generated by this system, and the
admin-chosen one must not travel by email.

---

## 5. Testing & CI

| Item | Status |
|---|---|
| GitHub Actions CI (JDK 17 + `mvn test`; Node lint/test/build) | ✅ written, not yet run |
| Frontend tests — **61 passing** | ✅ |
| Backend tests — ~70 written across 5 classes | ⚠️ **never compiled or run** |

Frontend coverage: wallet auth sequence (13), MVJCE email domain (32), certificate
status mapping (10), route guards (6).

Backend coverage written: `MvjceEmailValidatorTest`, `ResendEmailServiceTest`,
`AdminNonceServiceTest`, `WalletSignatureVerifierTest`, `AdminAuthServiceTest`
(real secp256k1 keypairs, not mocks).

---

## 6. ⚠️ Breaking change — read before running

`ADMIN_WALLET_ADDRESS` no longer has a hardcoded fallback. A real address committed
to the repository should not grant admin rights by default.

**You must set `ADMIN_WALLET_ADDRESS` in your run configuration or no admin will be
seeded and admin login will reject everyone.**

---

## 7. Environment variables

Existing: `DB_URL` · `DB_USERNAME` · `DB_PASSWORD` · `SUPABASE_URL` ·
`SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_STORAGE_BUCKET` · `JWT_SECRET` ·
`WALLET_ENCRYPTION_SECRET` · `ADMIN_WALLET_ADDRESS` · `ADMIN_EMAIL` ·
`FRONTEND_BASE_URL` · `CORS_ALLOWED_ORIGINS`

New: `EMAIL_API_KEY` · `EMAIL_FROM` · optionally `SPRING_PROFILES_ACTIVE=prod`

Never commit values. `EMAIL_API_KEY` is backend-only — never a `VITE_` variable.

---

## 8. Immediate next steps

1. **Set `ADMIN_WALLET_ADDRESS`** (section 6) or admin login will not work.
2. **Push and let CI compile the backend.** It has never been compiled — expect a
   fix-up round. Likeliest failure points: the web3j `Sign` API and Mockito
   strictness in `AdminAuthServiceTest`.
3. **Manually test admin login end to end** — the MetaMask signature prompt must
   appear, and rejecting it must block sign-in.
4. **Walk the app in a browser** at 375px and 1440px. No visual work is
   browser-verified.
5. **Deploy.** Everything is still localhost-only; a live HTTPS URL you can scan a
   real QR against would do more for perceived completeness than further code work.

---

## 9. Deferred by choice

Rate limiting · `@ControllerAdvice` · Actuator · admin management UI · bulk CSV
issuance · Flyway migrations · analytics · multi-tenancy · mobile app.

---

## 10. Known limitations

- **Resend sender:** with `onboarding@resend.dev`, mail is delivered **only to the
  address on your own Resend account**. Reaching real `@mvjce.edu.in` students needs
  SPF/DKIM records on a domain you control.
- **Nonces are in-memory:** correct for one instance; horizontal scaling would need
  a shared store.
- **`ddl-auto=update`** in dev cannot catch destructive schema drift. Prod uses
  `validate`; Flyway is the eventual answer.
- **Dev secret fallbacks remain** in `application.properties` so local work is not
  blocked. The validator makes them fatal under `prod` and noisy elsewhere.
