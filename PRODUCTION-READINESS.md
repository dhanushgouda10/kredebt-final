# Kredent — Production Readiness Notes

Assessment of what stands between the current build and something a college could
genuinely deploy. Grounded in the actual codebase, not a generic checklist.

**Status:** notes only — no code changes made.
**Date:** 20 August 2026

---

## Where the project stands today

The core system genuinely works end to end: certificate upload → QR stamping →
SHA-256 hashing of the stamped file → on-chain recording on Polygon Amoy →
student portal access → public QR verification that re-reads the live contract →
on-chain revocation → audit logging. Department-scoped pagination and filtering
are server-side throughout. That is a real, coherent product, and more than most
final-year projects reach.

What follows is what separates "works on my machine" from "deployable".

---

## 1. Security — the highest-priority gaps

### 1.1 Admin login has no proof of wallet ownership `CRITICAL`

`AdminAuthService.loginWithWallet()` does an address-only lookup:

```java
adminRepository.findByWalletAddress(address.toLowerCase())
```

Anyone who knows the admin's public wallet address can POST it to
`/api/auth/admin/wallet-login` and receive a valid ADMIN JWT. No signature is
ever verified. The code comments acknowledge this.

**Fix:** nonce challenge-response.
1. `GET /api/auth/admin/nonce?address=0x…` → server generates a random nonce,
   stores it with a short TTL.
2. Frontend asks MetaMask to `personal_sign` that nonce.
3. `POST /api/auth/admin/wallet-login` with `{ address, signature }`.
4. Server recovers the signer via web3j `Sign.signedPrefixedMessageToKey` and
   confirms it matches the claimed address, then invalidates the nonce.

web3j is already a dependency, so no new libraries. This is the single most
valuable addition to the project — it is also exactly what an examiner will ask
about in a blockchain credentials viva.

### 1.2 Insecure secret defaults ship in the config `HIGH`

`application.properties` currently falls back to working dev values:

```
jwt.secret=${JWT_SECRET:dev-only-insecure-secret-change-me-please-32chars-min}
wallet.encryption-secret=${WALLET_ENCRYPTION_SECRET:dev-only-insecure-wallet-secret-change-me}
admin.seed.wallet-address=${ADMIN_WALLET_ADDRESS:0xaB07a51fd2daBCceF287f0D3FFbce0a6D3297C3B}
```

If either env var is missing in production the app starts happily with a secret
that is public in the repository. Every JWT becomes forgeable and every stored
student private key becomes decryptable.

**Fix:** remove the defaults so the property is empty, then add a
`@PostConstruct` validator (or an `ApplicationRunner`) that fails startup when a
production profile is active and the secret is blank or matches a known dev
value. Fail loudly at boot rather than silently at runtime.

Also note the hardcoded admin wallet address default — that is a real address
committed to the repo and should not be a fallback.

### 1.3 No rate limiting on public endpoints `HIGH`

`/api/verify/**` and `/api/auth/**` are `permitAll()` with no throttling. The
verification endpoint hits the database *and* makes a live Polygon RPC call per
request, so it is both scrapeable and a cost/availability risk. The login
endpoints are open to unlimited credential stuffing.

**Fix:** Bucket4j is the usual Spring Boot choice. Per-IP limits — roughly 30/min
on verify, 5/min on login. Return `429` with `Retry-After`.

### 1.4 CSRF disabled `MEDIUM`

`csrf.disable()` is defensible for a stateless JWT API, but only if tokens are
never stored in cookies. Confirm the frontend keeps the JWT in memory or
`localStorage` and not a cookie, and document that decision — an examiner may
well ask why CSRF is off.

### 1.5 Swagger exposed publicly `MEDIUM`

`/v3/api-docs/**` and `/swagger-ui/**` are `permitAll()`. Fine in development;
in production this publishes your entire API surface. Gate behind a profile or
require authentication.

---

## 2. Testing — currently near-zero

There is exactly **one** backend test (`JdbcUrlEnvironmentPostProcessorTest`) and
**no** frontend tests. For a system that issues legal academic credentials, this
is the most visible engineering-maturity gap.

You do not need exhaustive coverage. You need tests on the parts where a bug
would be serious:

**Backend (JUnit 5 + Mockito, already available via spring-boot-starter-test):**
- `HashUtil.sha256Hex` — known input produces known digest
- `PdfStampingService` — the stamped PDF still parses, and hashing happens
  *after* stamping (this ordering is the anti-forgery guarantee; a test locks it
  in against future refactors)
- `WalletService` — encrypt → decrypt round-trips; two calls produce different
  ciphertext (proves the IV is random)
- `PublicVerificationService.verify()` — VERIFIED / REVOKED / INVALID /
  UNAVAILABLE branches, with the blockchain client mocked
- Ownership checks — student A cannot fetch student B's certificate
- `AdminSeeder` — the email-match "transfer wallet, don't insert" path

**Frontend (Vitest + Testing Library):**
- `certificateStatusMeta()` maps every enum value
- `VerifyResultPage` renders the correct verdict band per result
- `ProtectedRoute` redirects unauthenticated users

Ten to fifteen meaningful tests would transform how the repo reads.

---

## 3. Deployment — the biggest practical gap

Everything is localhost-only. There is no deployed instance.

This matters more than any remaining code polish: a live HTTPS URL you can hand
someone, scan a real QR against with a real phone, and point an evaluator at
does more for perceived completeness than another week of refactoring.

The Azure plan we drafted earlier still stands — App Service (Linux, Java 17)
for the backend, Static Web Apps for the frontend, Supabase and the existing
Polygon contract unchanged. The CORS config is already environment-driven, so
the frontend origin can be added without a redeploy.

**Blockers to clear first:** §1.2 (secrets must not have defaults) and a
production Spring profile.

---

## 4. Operational readiness

### 4.1 No CI
`.github/` contains only Java-upgrade tooling hooks — no workflows. A minimal
GitHub Actions workflow running `mvn test` and `npm run lint && npm run build`
on push costs ~20 lines and makes the repo look substantially more professional
to anyone who opens it.

### 4.2 No health endpoint
Add `spring-boot-starter-actuator` and expose `/actuator/health` only. Azure App
Service needs it for health probes.

### 4.3 Structured error responses
Confirm there is a `@ControllerAdvice` returning a consistent error shape.
Without one, unhandled exceptions leak stack traces to clients.

### 4.4 Logging
Ensure no secret, private key, or full JWT is ever logged. Add correlation IDs
if time permits.

### 4.5 Database migrations
`ddl-auto=update` is convenient but unsafe for production — it will not catch
destructive schema drift. Flyway with versioned migrations is the production
answer. This is a larger change; acceptable to document as a known limitation
rather than implement.

---

## 5. Feature completeness

These extend what exists rather than adding new architecture:

| Feature | Why it matters | Effort |
|---|---|---|
| **Manage admins screen** | A second admin currently requires manual DB insertion. `AdminSeeder` only ever seeds one. | Medium |
| **Bulk issuance via CSV** | Colleges issue an entire graduating batch at once, not one at a time. Directly addresses a real workflow gap. | Medium |
| **Audit log CSV export** | Compliance record-keeping — an auditor will ask for this. | Small |
| **Certificate search by student name** on public verify | Currently requires the exact certificate number. | Small |
| **Email notification on issuance** | Student learns their certificate exists without checking the portal. | Medium |

Deliberately excluded: analytics dashboards, multi-tenancy, mobile apps. They
inflate scope without strengthening the core claim.

---

## 6. Frontend remaining items

Mostly addressed in recent passes. What is left:

- **Bundle size** — main chunk ~440 KB. Route-based code splitting is now in
  place; the remaining weight is largely ethers.js, which only the admin path
  needs. Worth confirming it is not in the public entry chunk.
- **Accent discipline** — some screens still use navy, orange, gold and red in
  one viewport. Needs a per-screen human pass, not a codemod.
- **Live browser verification** — nothing in recent passes has been confirmed in
  a real browser. Before any demo, walk every route at 375px and 1440px.

---

## 7. Documentation

Currently the weakest area relative to effort required.

- **README** — architecture diagram (frontend ↔ backend ↔ Supabase ↔ Polygon),
  setup steps, env var table, and a plain-language "how verification works"
  section. Someone should be able to understand and run the project without you
  in the room.
- **API documentation** — Swagger is wired; make sure endpoints carry
  `@Operation` descriptions.
- **Architecture Decision Records** — short notes on why QR-before-hash, why
  server-managed student wallets, why Polygon Amoy. Examiners reward visible
  reasoning.

---

## Suggested order

**Before any demo or deployment**
1. Admin signature verification (§1.1)
2. Remove insecure secret defaults + startup validation (§1.2)
3. Deploy to Azure (§3)
4. README with architecture diagram (§7)

**Strengthens the engineering story**
5. Core test suite (§2)
6. GitHub Actions CI (§4.1)
7. Rate limiting (§1.3)

**If time allows**
8. Manage admins (§5)
9. Bulk CSV issuance (§5)
10. Audit log export (§5)

Items 1–4 are what turn this from a strong project into a defensible one. Item 1
in particular closes a hole that someone will find if they look, and fixing it
demonstrates exactly the security thinking a blockchain credentials system is
supposed to show.
