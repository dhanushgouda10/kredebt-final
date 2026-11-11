# Kredent Institutional Registry — Workflow & Technical Documentation

## 1. Purpose

Kredent only lets a college issue certificates after the college has been **registered in the registry**.
That job belongs to the **Institutional Registry**, a separate module inside this project:

1. A college registers in the registry and is **issued an institutional ID**.
2. The college enters the one-time code e-mailed to its official address. **Only then is the institutional ID shown**, and the institution is approved automatically.
3. The college administrator uses that **institutional ID** on the Kredent *Administration login* to verify the
   institution (email OTP + MetaMask wallet) and start issuing certificates.

> The registry is Kredent's own component. It is **not** an AICTE or government system, does not use AICTE branding
> and is not connected to AICTE. It plays the role of the registering body for this project.

## 2. End-to-end workflow

```
College                 Institutional Registry                 Kredent Administration
-------                 ----------------------                 ----------------------
Register Institution -> record created (PENDING)
                        institutional ID issued (KR-YYYY-NNNNN)
                        OTP e-mailed to the official address
Enter OTP ------------> e-mail verified; institution APPROVED;
                        institutional ID shown (not before)
Use institutional ID --------------------------------------->  lookup (must be APPROVED)
                                                                OTP to the registered HOI e-mail
                                                                MetaMask signature links the wallet
                                                                institution is now ACTIVE on Kredent
                                                                admin signs in with ID + wallet
Students pick the college when registering / logging in; each college sees only its own students,
certificates and audit trail.
```

### Statuses

| Registry status | Meaning | Can the college verify on Kredent? |
|---|---|---|
| PENDING | Registered, e-mail code not yet entered (no ID shown yet) | No (HTTP 403 `INSTITUTION_PENDING`) |
| APPROVED | E-mail code verified (automatic) | Yes |
| SUSPENDED | Blocked by the registry administrator | No; existing admin sessions are also refused |

The e-mail address is proven later, when the Kredent administration sends a one-time code to it. The optional registry-admin API can still suspend a college; a suspended college stays suspended.

## 3. Institutional ID

* Issued **by the registry**, never typed in by the college.
* Format `KR-<year>-<5 digits>`, for example `KR-2026-48213`. Digits come from a secure random generator and are
  re-drawn on collision, so IDs are unique and not guessable in sequence.
* Shown once on the registration success screen (with a copy button) and listed publicly for approved institutions.
* Used as the sign-in key on *Administration login* and as the link between the registry and Kredent
  (`institutions.registry_institution_id`).

## 4. Screens (frontend)

| Route | Purpose |
|---|---|
| `/registry` | Approved institutions: state / district / search filters, paged table, statistics |
| `/registry/register` | Registration form, then the e-mail code step; the institutional ID appears after the code is accepted |
| `/registry/verify-email` | Enter / re-send the code later using the official e-mail address |
| `/admin/login` | Kredent administration: first-time verification and sign-in with the institutional ID |

"Register Institution" links open the registry in a new tab. The registry pages use their own portal-style layout (utility bar, emblem header, navigation bar, filter + table pages) and carry no Kredent, AICTE or government branding; the footer states that the registry is independent.

## 5. API

Public (no sign-in):

| Method & path | Description |
|---|---|
| `POST /api/registry/institutions` | Register a college. Body: `collegeName, state, district, hoiName, officialEmail, contactNumber, password, confirmPassword`. Returns `status` (PENDING), `emailSent`, `email`, `message` — no ID yet. |
| `POST /api/registry/email/send` | Send/resend the e-mail OTP (`email`). 60 s cooldown. |
| `POST /api/registry/email/verify` | Verify the OTP (`email, otp`). Returns the `institutionId` on success. |
| `GET /api/auth/institution/list?search=` | Approved institutions (ID, name, state, district, joined flag). No contact details. |
| `POST /api/auth/institution/lookup` / `otp/send` / `otp/verify` / `complete` | Kredent administration verification steps. |

Registry administrator (Bearer token from `POST /api/registry/admin/login`):
`GET /api/registry/admin/institutions`, `GET /api/registry/admin/logs`,
`POST /api/registry/admin/institutions/{id}/approve`, `POST /api/registry/admin/institutions/{id}/suspend`.

## 6. Data storage

| Data | Where |
|---|---|
| Registered colleges, registry admin, e-mail OTPs, verification log | **SQLite** — `data/registry.db` (relative to the folder the backend is started from) |
| Verified institutions on Kredent (`institutions`), students, certificates, audit log | **PostgreSQL** (Supabase) |

`registry.db` is a binary file — open it with a SQLite viewer, not a text editor.

## 7. Security rules

* Passwords (college and registry admin) are stored only as BCrypt hashes.
* OTPs: 6 digits, secure random, valid 5 minutes, max 5 attempts, 60 s resend cooldown, stored hashed, single use,
  **never returned by any API and never logged**.
* Gmail credentials come from environment variables / `backend/.env` only; nothing is in source code and nothing
  reaches the frontend. `.env` is git-ignored.
* Registry admin sign-in is rate-limited and uses a separate token from Kredent's own sessions.
* Public lookups mask the HOI e-mail address.

## 8. Configuration (`backend/.env`)

```
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=<sender gmail address>
MAIL_PASSWORD=<16-character Gmail App Password>
MAIL_FROM=<sender gmail address>
REGISTRY_ADMIN_EMAIL=registry.admin@kredent.local
REGISTRY_ADMIN_PASSWORD=<choose one>      # applied to the registry admin on every start
REGISTRY_SEED_SAMPLE_DATA=true            # set to false to start with an empty registry
```

The backend reads `.env` from `./backend/.env` or `./.env`, so it works whether it is started from the project root
or from `backend/`. Real environment variables take priority. Restart the backend after any change.

Local development origins allowed by CORS: `localhost` ports 3000, 5173, 5174, 5175.

## 9. Running locally

1. Start the backend (port 8081) and the frontend (`npm run dev`, port 5173 or the next free one).
2. Open `/registry/admin`, sign in with the registry admin e-mail and password from `.env`.
3. Register a college at `/registry/register`; enter the e-mail code; the ID is shown after it is accepted.
4. Open `/admin/login`, enter the institutional ID and complete the OTP + MetaMask steps.

When the registry is empty and `REGISTRY_SEED_SAMPLE_DATA=true`, five sample colleges are created for local testing
(IDs `DEMO-1001` to `DEMO-3001`; three approved, one pending, one suspended). Set the flag to `false` and delete
`data/registry.db` for a clean registry. Colleges registered earlier with a self-chosen ID keep that ID.

## 10. Verification performed

* Backend: 77 automated tests (1 skipped benchmark) pass, including an end-to-end test that registers a college,
  checks the issued ID format, looks it up on the administration login straight away, and confirms it appears in the student college picker
  and that suspending a college cuts off its administrators. Mail, storage and blockchain RPC are mocked in tests.
* Frontend: lint, 50 unit tests and a production build pass; registry pages were rendered and inspected with mocked API
  responses.

Not tested here: real Gmail delivery, real MetaMask, a live Polygon Amoy transaction, real Supabase storage.

## 11. Known limitations

* The smart contract has a single `issuer`, so all colleges on one deployment share the issuer wallet; data is
  separated per college in the database, not on-chain.
* The registry is a project component, not an external authority; approval is automatic once the official e-mail is verified.

## Student portal and colleges

- Registration and login show a **College** dropdown fed by `GET /api/auth/institution/list` (approved colleges; those not yet onboarded in Kredent are listed but disabled).
- A student account belongs to one college. USN is unique per college; email is unique across the platform. Login with the wrong college returns 401.
- Administrators only see students and certificates of their own college.
- Students see a certificate only after it is issued (MINTED) or REVOKED; drafts are hidden.
- Database (Supabase/PostgreSQL): in development (`ddl-auto=update`) `StudentSchemaPatcher` drops the old global unique constraint on `students.usn`. In production (`ddl-auto=validate`) run `backend/docs/multi-institution-migration.sql` once in the Supabase SQL editor. Legacy rows can be adopted with `INSTITUTION_ADOPT_LEGACY_DATA_FOR`.

## Automatic certificate generation

- Admins no longer upload a PDF. Issuing creates the certificate record, then `POST /api/admin/certificates/{id}/generate` draws the standard Kredent certificate (`CertificateRenderer`) from the student's record: college name (from the registry), student name and USN, degree, department, academic year, issue date, certificate number and a verification QR.
- The QR links to `/verify/<certificate number>`. It is drawn before hashing, so it is part of the exact bytes whose SHA-256 is stored and minted on-chain.
- Verification: scanning the QR opens the public verify page; uploading the PDF there recomputes the hash, and any changed byte is reported as TAMPERED.
- Once a certificate is on-chain it cannot be regenerated or replaced. The old upload endpoint remains available for pre-made PDFs.
- Signature lines carry titles only (Principal, Head of Department, Authorised Signatory); no names are generated.
