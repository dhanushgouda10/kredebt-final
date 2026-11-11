# Kredent — Verification Guide

How to prove everything actually works, in the order that fails fastest.

Each stage is cheap and gates the next. Do not skip ahead: if Stage 1 fails,
nothing after it can be trusted.

**Rule for every step:** write down PASS or FAIL. "Looked fine" is not a result.

---

## Your setup

- **Backend:** IntelliJ IDEA (Run Configuration, bundled Maven) — `localhost:8081`
- **Frontend:** VS Code terminal (`npm run dev`) — `localhost:5173`

You do **not** need the `mvn` command-line tool. IntelliJ ships its own Maven, so
every backend step below is given as an IntelliJ action.

---

## Stage 0 — Prerequisites (5 min)

**IntelliJ — confirm the JDK is 17:**
File → Project Structure → Project → SDK. Must be 17.x.
If it says 11 or 21, change it to 17 — the `pom.xml` targets 17.

**VS Code terminal:**
```bash
node -version     # 20.x
```

### ⚠️ Set this or admin login will reject you

The hardcoded `ADMIN_WALLET_ADDRESS` fallback was removed. In your IntelliJ Run
Configuration (Environment variables), confirm all of these are set:

```
DB_URL, DB_USERNAME, DB_PASSWORD
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET
JWT_SECRET, WALLET_ENCRYPTION_SECRET
ADMIN_WALLET_ADDRESS   ← MUST be your MetaMask address
ADMIN_EMAIL
FRONTEND_BASE_URL, CORS_ALLOWED_ORIGINS
```

`ADMIN_WALLET_ADDRESS` must be the address of the MetaMask account you will sign
with. Not a different one. This is the single most likely cause of "login fails".

- [ ] All env vars present
- [ ] `ADMIN_WALLET_ADDRESS` matches my MetaMask account

---

## Stage 1 — Does the backend compile? (5 min)

**The backend has never been compiled.** Everything else is meaningless until this
passes.

**In IntelliJ:** `Build` → `Rebuild Project`

Watch the Build tool window at the bottom. You want **"Build completed
successfully"**. Red entries are compile errors — click one to jump to the line.

*Alternative:* open the Maven tool window (right edge) → `kredent` → Lifecycle →
double-click `compile`.

**Do not skip this by just pressing Run.** IntelliJ will happily launch a stale
build of the last working version and you will think everything compiled when it
did not.

**If it fails**, copy the full error text from the Build window and send it to me.
Most likely spots:

| Symptom | Likely cause |
|---|---|
| `cannot find symbol: signPrefixedMessage` | web3j 4.10.3 API differs from what I wrote |
| `incompatible types` in `Sign.SignatureData` | constructor arg order |
| `cannot find symbol` on a getter/setter | entity method I mis-assumed |
| Anything in `ResendEmailService` | `RestClient` fluent chain |

- [ ] Rebuild Project completes with no errors

---

## Stage 2 — Do the backend tests pass? (5 min)

**In IntelliJ:** in the Project pane, right-click
`backend/src/test/java` → **Run 'All Tests'**

A test runner panel opens with a green/red tree. Click any red test to see the
failure.

*Alternative:* Maven tool window → Lifecycle → double-click `test`.

Expect ~70 tests across 6 classes. These prove the security properties by
construction — read the failures carefully, they are meaningful.

| Test class | What a failure means |
|---|---|
| `OtpUtilTest` / `InstitutionVerificationServiceTest` | OTP hashing or verification rules are wrong |
| `AdminNonceServiceTest` | Nonces may be reusable → signature replay possible |
| `WalletSignatureVerifierTest` | **Crypto is wrong. Stop and fix before anything else.** |
| `AdminAuthServiceTest` | The auth bypass is not actually closed |
| `ResendEmailServiceTest` | Email may leak secrets, or throw and break registration |

A `Mockito` strictness error (`UnnecessaryStubbingException`) is a test-harness
problem, not a security problem — tell me and I will fix the stub.

- [ ] `mvn test` passes, N = ______ tests

---

## Stage 3 — Frontend checks (3 min)

**In the VS Code terminal**, from the `frontend` folder:

```bash
npm run lint      # expect: clean, no output
npm test          # expect: 61 passed
npm run build     # expect: built in ~1s
```

If `npm test` says the script is missing, run `npm install` first — Vitest was
added recently and your `node_modules` may predate it.

- [ ] Lint clean · [ ] 61 tests pass · [ ] Build succeeds

---

## Stage 4 — Does it start? (5 min)

**IntelliJ:** press Run (▶) on your existing Spring Boot configuration.
**VS Code:** `npm run dev` in the `frontend` folder.

Then, in a terminal:

```bash
curl -i http://localhost:8081/api/auth/departments
```

Expect `200` and a JSON list.

**Check the startup log for the secret warning.** If you see a block saying
`INSECURE CONFIGURATION DETECTED`, that is the new validator telling you a
development secret is in use. Fine locally; must be resolved before deploying.

- [ ] Backend starts · [ ] Departments endpoint returns 200
- [ ] Noted whether the insecure-config warning appeared: YES / NO
- [ ] Frontend loads at `localhost:5173`

**Two localhost gotchas specific to your split setup:**

1. `frontend/.env` must have `VITE_API_BASE_URL=http://localhost:8081`. If the
   frontend shows network errors on every page, check this first.
2. **Restart the Vite dev server** after pulling these changes. Vite caches
   aggressively and new CSS tokens often will not hot-reload:
   ```bash
   rm -rf node_modules/.vite && npm run dev
   ```
   Then hard-refresh the browser (Cmd+Shift+R).

---

## Stage 5 — The security fix (10 min) ★ MOST IMPORTANT

This is the vulnerability that was closed. Prove it four ways.

### 5.1 The nonce endpoint responds

```bash
curl "http://localhost:8081/api/auth/admin/nonce?address=0xYOUR_ADMIN_ADDRESS"
```
Expect `{"nonce":"Sign in to Kredent as an institution administrator...."}`

- [ ] Returns a nonce containing the word "Nonce:"

### 5.2 The old attack no longer works ★

This is the exact exploit that used to succeed — knowing the public address was
enough to get an admin session.

```bash
curl -i -X POST http://localhost:8081/api/auth/admin/wallet-login \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0xYOUR_ADMIN_ADDRESS"}'
```

**Expect `400` or `401`. NOT 200. NOT a token.**

If this returns a token, the fix is not working — stop and tell me.

- [ ] Returns 400/401 with no token ← **the whole point**

### 5.3 A wrong signature is rejected

```bash
curl -i -X POST http://localhost:8081/api/auth/admin/wallet-login \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0xYOUR_ADMIN_ADDRESS","signature":"0x'$(printf '0%.0s' {1..130})'"}'
```
Expect `401`.

- [ ] Returns 401

### 5.4 The real login works

In the browser: **Administration → Login as Admin**

1. MetaMask asks to connect → approve
2. **MetaMask asks you to SIGN a message** ← this prompt is new. If it does not
   appear, the frontend is not calling the new flow.
3. Read the message — it should be human-readable and mention Kredent
4. Approve → you land on Issue Degree

Then repeat and **click Reject** at the signature step.
Expect: a message explaining signing is required. No login.

- [ ] Signature prompt appears · [ ] Message is readable · [ ] Login succeeds
- [ ] Rejecting the signature blocks login

### 5.5 A nonce cannot be reused

Log in, log out, log in again. The second login must request a **new** nonce
(the signature text you are shown will differ).

- [ ] Second login shows a different nonce

---

## Stage 6 — Email handling (5 min)

The institutional email-domain restriction was removed; any syntactically valid email is accepted.

### 6.1 Validation

Admin → Students → Add Student with `not-an-email`. Expect an inline error and no request.

- [ ] Invalid email blocked in admin form and on public signup

### 6.2 Backend enforcement

```bash
curl -i -X POST http://localhost:8081/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test","usn":"TEST001","email":"not-an-email","phone":"9999999999","department":"CSE","password":"Test@1234"}'
```

**Expect `400`.**

- [ ] Returns 400

### 6.3 Case-insensitivity

Register with `Student@Example.EDU`. The stored email should be lowercase.

- [ ] Accepted · [ ] Stored lowercase

### 6.4 Real email

Only if `EMAIL_API_KEY` is set.

**Resend limitation:** with `onboarding@resend.dev`, mail is delivered **only to
the address on your own Resend account**. So for this test, create a student whose
email is *your* Resend account address.

- [ ] Email arrives
- [ ] Contains name, USN, department, login link
- [ ] Contains **NO password**, no wallet address ← check this explicitly
- [ ] Says "automated email from Kredent. Please do not reply."
- [ ] Renders correctly on a phone

### 6.5 Email failure does not break registration

Temporarily set `EMAIL_API_KEY` to `re_invalid_key` and restart. Create a student.

Expect: student **is created**, and the admin sees an amber notice saying the
notification could not be delivered.

- [ ] Student still created · [ ] Warning shown, not an error

---

## Stage 7 — Nothing was broken (20 min)

The whole point of a regression pass: confirm the old features still work.

**Admin**
- [ ] Students list loads, department filter works
- [ ] Create student works
- [ ] Issue Degree: select student, upload PDF → certificate created
- [ ] Certificate Registry lists it
- [ ] Mint on blockchain (MetaMask signs) → status MINTED, tx hash appears
- [ ] Revoke → status REVOKED
- [ ] Audit Logs shows issuance + revocation

**Student**
- [ ] Login works
- [ ] Dashboard shows name, USN, department
- [ ] My Certificates lists certificates
- [ ] Detail page: status in plain language, download works
- [ ] "Verification details" expands to show hash/token/tx
- [ ] Downloaded PDF has a QR code

**Public verification**
- [ ] `/verify` accepts a certificate number
- [ ] A MINTED certificate → green "Genuine certificate"
- [ ] A REVOKED certificate → amber "Revoked by the institution"
- [ ] A made-up number → red "Not a valid certificate"
- [ ] Upload the correct PDF → authentic
- [ ] Edit the PDF in any editor, re-upload → **tampered** ← the core claim
- [ ] **Scan the QR with your phone** → verification page opens

**Authorisation**
- [ ] Log in as student, manually visit `/admin/students` → redirected away
- [ ] `curl http://localhost:8081/api/admin/students` with no token → 401

---

## Stage 8 — Visual pass (15 min)

None of the redesign has been browser-verified. Check at **375px** (DevTools
device toolbar) and **1440px**.

Per page — Home, Verify, Verify result, Login, Admin login, all admin pages, all
student pages:

- [ ] No horizontal scrollbar
- [ ] No text clipped or overlapping
- [ ] Buttons reachable, not cut off
- [ ] Background is warm off-white (`#faf7f0`), not stark white

Quick console check for the surface colour:
```js
getComputedStyle(document.body).backgroundColor   // expect rgb(250, 247, 240)
```

Specifically:
- [ ] Hero: no white/navy strip at any edge; campus video visible through overlay
- [ ] Hero text readable over the video's **brightest** frames
- [ ] Navbar: two tiers on desktop, drawer on mobile, no hamburger beside visible links
- [ ] Footer: charcoal rail + navy columns + blush strip
- [ ] Verification result: verdict is the first and largest thing, visible without scrolling on a phone

Reduced motion — macOS System Settings → Accessibility → Display → Reduce motion:
- [ ] Page fully visible, nothing invisible, video does not autoplay

---

## Stage 9 — CI (5 min)

```bash
git add -A
git commit -m "feat: signature-based admin auth, email notifications, hardening"
git push
```

GitHub → Actions tab. Both jobs must go green.

- [ ] Backend job passes · [ ] Frontend job passes

CI is the durable answer to "is it still working" — from here on, every push is
checked automatically.

---

## If something fails

Send me:
1. Which stage and step
2. The **exact** error text (not a paraphrase)
3. For backend: the full `mvn` output
4. For frontend: the browser console error
5. For API calls: the full `curl -i` response

The most valuable single result you can send me right now is **Stage 1** — whether
the backend compiles at all.

---

## Priority if you are short on time

1. **Stage 1** — does it compile
2. **Stage 5.2 and 5.4** — is the auth bypass actually closed
3. **Stage 7** public verification — does the core product still work
4. Everything else
