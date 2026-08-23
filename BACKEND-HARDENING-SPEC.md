# Kredent — Backend Hardening Spec (for Cursor)

Paste the whole of this into Cursor, in the Kredent repo, with a working Java 17 +
Maven toolchain. It implements the backend half of the production-hardening pass.

The frontend half is **already done and merged** — see "Contract already fixed by
the frontend" below. Your backend implementation must match it exactly.

---

## Absolute rules

Do not modify: the smart contract, the deployed contract address, Polygon network
config, Supabase integration, the database schema, certificate issuance /
QR-stamping / SHA-256 / minting / revocation / audit logging behaviour, or any
existing route path other than the one change specified in §1.

Do not add Redis, Flyway, a new auth framework, or any dependency not named here.
Do not refactor working code for style. Keep changes minimal and surgical.

After every phase run `mvn -B test` from `backend/`. Do not start a new phase on a
failing build.

---

## Contract already fixed by the frontend — implement to match

`frontend/src/services/authService.js` and `adminWalletAuth.js` now call:

**1. Challenge request**
```
GET /api/auth/admin/nonce?address=0x...
→ 200 { "nonce": "<string to be signed>" }
```
Must be `permitAll()`. Must return a challenge **regardless of whether the address
is a known admin**, so the endpoint cannot be used to enumerate admin wallets.

**2. Authentication**
```
POST /api/auth/admin/wallet-login
Body: { "walletAddress": "0x...", "signature": "0x..." }
→ 200  same AuthResponse shape as today (token, role, id, fullName, email)
→ 401  on any failure
```

The existing DTO `AdminWalletLoginRequest` currently has only `walletAddress`; add
a `signature` field. The old address-only request must now be rejected — a missing
or blank signature is a 401, never a successful login.

---

## Phase 1 — Admin signature verification `HIGHEST PRIORITY`

### 1.1 Nonce store

New `service/AdminNonceService`. In-memory, no new infrastructure:

- Backing map: `ConcurrentHashMap<String /* lowercased address */, NonceEntry>`
- `NonceEntry` holds the nonce string and an `Instant expiresAt`
- Generate with `SecureRandom` — at least 32 bytes, hex or Base64 encoded
- Make the signed message human-readable, e.g.
  `"Sign in to Kredent as MVJCE administrator.\n\nNonce: <random>\nIssued: <ISO instant>"`
  MetaMask shows this text to the user; an opaque blob trains people to sign blindly
- TTL: 5 minutes
- `issue(address)` overwrites any existing entry for that address (requesting a new
  challenge invalidates the previous one)
- `consume(address)` returns the nonce **and removes it atomically** — use
  `map.remove()` so a nonce can never be used twice, even under concurrent requests
- Evict expired entries opportunistically on access, plus a `@Scheduled` sweep
- Cap the map size (e.g. 10 000) and reject/evict beyond it, so an attacker cannot
  exhaust heap by requesting unlimited nonces

**Single-instance limitation — document it in the class Javadoc.** If the app is
ever scaled horizontally, a nonce issued by instance A will not be found by
instance B. Acceptable for this deployment; note it rather than hide it.

### 1.2 Signature verification

New `service/WalletSignatureVerifier`. web3j is already a dependency.

```java
// Recover the signer from an EIP-191 personal_sign signature.
// MetaMask prefixes the message with "\x19Ethereum Signed Message:\n<len>",
// which Sign.signedPrefixedMessageToKey handles for you.
byte[] sig = Numeric.hexStringToByteArray(signature);   // 65 bytes: r(32) s(32) v(1)
byte v = sig[64];
if (v < 27) v += 27;                                     // some wallets return 0/1
Sign.SignatureData data = new Sign.SignatureData(
        v,
        Arrays.copyOfRange(sig, 0, 32),
        Arrays.copyOfRange(sig, 32, 64));
BigInteger publicKey = Sign.signedPrefixedMessageToKey(message.getBytes(UTF_8), data);
String recovered = "0x" + Keys.getAddress(publicKey);
```

Compare `recovered` to the claimed address **case-insensitively** (lowercase both).
Return a boolean; never throw the raw exception outward.

Guard before you parse: signature must be non-blank, `0x`-prefixed, and exactly
132 characters. Malformed input is a 401, not a 500.

### 1.3 Wire into `AdminAuthService.loginWithWallet`

Replace the current address-only lookup with, in this order:

1. Validate address format (`^0x[a-fA-F0-9]{40}$`) → 401 if bad
2. `consume(address)` the nonce → 401 if absent or expired
3. Verify the signature against that nonce → 401 if it does not recover to the
   claimed address
4. `adminRepository.findByWalletAddress(address.toLowerCase())` → 401 if unknown
5. Issue the **existing** JWT via the existing `JwtService` — do not change token
   shape, claims, or expiry
6. Return the existing `AuthResponse`

Steps 2–4 must all return the **same** generic message (e.g. "Authentication
failed"). Different messages for "bad signature" vs "unknown wallet" tell an
attacker which admin addresses are real.

Delete the outdated comment in `AdminAuthService` that says proof-of-ownership is
not yet implemented.

### 1.4 Do not log

No signatures, no nonces, no JWTs, no recovered addresses at INFO. A failed login
may log the fact and the source IP only.

---

## Phase 2 — Secrets

In `application.properties`, remove the working fallbacks:

```
jwt.secret=${JWT_SECRET:dev-only-insecure-secret-change-me-please-32chars-min}
wallet.encryption-secret=${WALLET_ENCRYPTION_SECRET:dev-only-insecure-wallet-secret-change-me}
admin.seed.wallet-address=${ADMIN_WALLET_ADDRESS:0xaB07a51fd2daBCceF287f0D3FFbce0a6D3297C3B}
```

Change to `${JWT_SECRET:}` etc. Move the dev values into
`application-dev.properties` so local work stays convenient.

Add `config/SecretsValidator` implementing `InitializingBean` or
`ApplicationRunner`. When the `prod` profile is active, fail startup if any
required secret is blank, shorter than 32 chars, or contains `dev-only` /
`change-me`. Throw `IllegalStateException` with a message naming the **variable**
— never the value.

`WALLET_ENCRYPTION_SECRET` deserves a warning comment: rotating it makes every
previously encrypted student key undecryptable. It must be set once and preserved.

---

## Phase 3 — Profiles

Create `application-dev.properties` and `application-prod.properties`. Keep shared
config in `application.properties`; put only what differs in the profile files. Do
not duplicate everything.

Use the variable names already in the project: `DB_URL`, `DB_USERNAME`,
`DB_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_STORAGE_BUCKET`, `JWT_SECRET`, `WALLET_ENCRYPTION_SECRET`,
`ADMIN_WALLET_ADDRESS`, `ADMIN_EMAIL`, `FRONTEND_BASE_URL`, `CORS_ALLOWED_ORIGINS`.
Do not invent new names.

Prod must not contain a localhost URL anywhere.

---

## Phase 4 — Rate limiting

Add Bucket4j (`com.bucket4j:bucket4j-core`). Implement a `OncePerRequestFilter`
registered before the JWT filter:

- `/api/auth/**` → 5 requests/minute/IP
- `/api/verify/**` → 30 requests/minute/IP
- everything else → unlimited (authenticated certificate operations must not be
  throttled)

Buckets in a `ConcurrentHashMap` keyed by client IP, with a size cap. On breach
return `429` with a `Retry-After` header and the standard error body from Phase 7.

Resolve the client IP from `X-Forwarded-For` when present (Azure App Service sits
behind a proxy), else `getRemoteAddr()`. Document that this is per-instance.

---

## Phase 5 — Swagger

Currently `permitAll()` on `/v3/api-docs/**` and `/swagger-ui/**`. Restrict to the
dev profile: `springdoc.api-docs.enabled` / `springdoc.swagger-ui.enabled` false in
`application-prod.properties`, and drop the `permitAll()` matchers when prod is
active. Keep it fully working in dev.

---

## Phase 6 — Security config review

Verify and leave otherwise alone: stateless sessions, JWT filter placement, ADMIN
and STUDENT matchers, env-driven CORS.

Add a comment above `csrf.disable()` recording *why*: the API is stateless and the
token is held in browser storage, not a cookie, so there is no ambient credential
for a cross-site request to abuse. If tokens ever move to cookies, CSRF protection
must come back. Do not change token storage.

---

## Phase 7 — Global error handling

Add `@RestControllerAdvice` returning a consistent body:

```json
{ "timestamp": "...", "status": 401, "error": "Unauthorized", "message": "...", "path": "..." }
```

**Compatibility requirement:** the frontend's `parseErrorMessage` in
`frontend/src/utils/http.js` reads the error text out of responses today. Read that
function first and keep the field it depends on populated, or you will break every
error message in the UI.

Never leak stack traces, SQL, credentials, JWTs, or key material. Map
`ResponseStatusException` through unchanged so existing 401/403/404 behaviour is
preserved.

---

## Phase 8 — Actuator

Add `spring-boot-starter-actuator`. Expose **only** health:

```
management.endpoints.web.exposure.include=health
management.endpoint.health.show-details=never
```

`permitAll()` on `/actuator/health` for the Azure probe. Do not expose env, beans,
configprops, or mappings.

---

## Phase 9 — Tests

Target ~25–35 focused tests.

**`AdminAuthServiceTest`** — the important one:
- valid wallet + valid signature → returns a token
- valid wallet + signature from a *different* key → 401
- signature valid but for a *different* nonce → 401
- expired nonce → 401
- **reused nonce → 401** (call login twice with the same nonce; second must fail)
- unknown wallet, valid signature → 401
- malformed signature (wrong length, missing `0x`) → 401, not 500
- all failure messages identical

Generate real keypairs with `Keys.createEcKeyPair()` and sign with
`Sign.signPrefixedMessage` so you are testing genuine cryptography, not a mock.

**`AdminNonceServiceTest`** — nonce is single-use; expiry works; re-issuing
replaces the previous nonce; two addresses get different nonces.

**`HashUtilTest`** — known input → known digest (e.g. SHA-256 of `"abc"` is
`ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`).

**`PdfStampingServiceTest`** — stamped output still parses as a PDF; and critically,
that hashing happens **after** stamping: hash the stamped bytes and assert it
differs from the hash of the original. This ordering is the anti-forgery guarantee
and nothing currently stops a refactor breaking it.

**`WalletServiceTest`** — encrypt→decrypt round-trips; encrypting the same
plaintext twice yields different ciphertext (proves random IV).

**`PublicVerificationServiceTest`** — VERIFIED / REVOKED / INVALID / UNAVAILABLE,
with the blockchain client mocked. **No real RPC calls.** Include the case where
the DB says MINTED but the chain read fails → UNAVAILABLE, never VERIFIED.

**Authorization** — `@WebMvcTest` or `@SpringBootTest`: student A cannot fetch
student B's certificate; unauthenticated request to `/api/admin/**` → 401; STUDENT
token on `/api/admin/**` → 403.

**`AdminSeederTest`** — existing email-match "update wallet in place, don't insert"
behaviour. Read the current implementation first; do not change its intent.

---

## Phase 10 — Final checks

Run `mvn -B test`. Then grep for and report: hardcoded secrets, private keys,
localhost in prod config, permissive CORS, remaining `permitAll()` matchers.

Report at the end: files changed (backend / config / tests), the new auth flow,
test count and result, anything still needing manual verification, and the exact
env vars needed for production — **names only, never values**.

State plainly what you verified by running versus only by reading.

---

## Do NOT implement in this pass

Admin management UI, bulk CSV issuance, email notifications, Flyway, multi-tenancy,
analytics, contract changes, database redesign.
